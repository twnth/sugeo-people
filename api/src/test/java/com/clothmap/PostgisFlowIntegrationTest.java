package com.clothmap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@EnabledIfEnvironmentVariable(named = "CLOTH_MAP_INTEGRATION_TEST", matches = "1")
class PostgisFlowIntegrationTest {
  @Container
  static PostgreSQLContainer<?> db = new PostgreSQLContainer<>(
      DockerImageName.parse("postgis/postgis:17-3.6").asCompatibleSubstituteFor("postgres"))
      .withDatabaseName("clothmap_test")
      .withUsername("clothmap_test")
      .withPassword("test-only-password");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", db::getJdbcUrl);
    registry.add("spring.datasource.username", db::getUsername);
    registry.add("spring.datasource.password", db::getPassword);
    registry.add("app.admin-username", () -> "integration-admin");
    registry.add("app.admin-password", () -> "integration-password");
    registry.add("app.anonymous-secret", () -> "test-only-anonymous-signing-secret-32-chars");
    registry.add("app.photo-storage-dir", () -> "build/test-photos");
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired JdbcTemplate jdbc;

  @Test
  void photoObservationBecomesTrustedOnlyAfterAdminApproval() throws Exception {
    UUID boxId = UUID.randomUUID();
    jdbc.update("insert into collection_boxes(id,name,address,location,source_type,status) values (?,?,?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,'PUBLIC','UNVERIFIED')",
        boxId, "사진 검증 테스트 수거함", "통합 테스트 전용 위치", 126.98, 37.55);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", output);
    MockMultipartFile photo = new MockMultipartFile("photo", "evidence.png", "image/png", output.toByteArray());
    String response = mvc.perform(multipart("/api/v1/boxes/{id}/observations", boxId)
            .file(photo).param("type", "EXISTS").param("description", "현장에서 수거함을 확인했습니다."))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
        .andReturn().getResponse().getContentAsString();
    String reportId = mapper.readTree(response).get("id").asText();
    mvc.perform(get("/api/v1/boxes/{id}", boxId))
        .andExpect(status().isOk()).andExpect(jsonPath("$.lastPhotoVerifiedAt").isEmpty());
    mvc.perform(get("/api/v1/boxes/{id}/photo", boxId)).andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/admin/reports/{id}/photo", reportId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType(MediaType.IMAGE_JPEG));
    mvc.perform(post("/api/v1/admin/reports/{id}/approve", reportId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/boxes/{id}", boxId))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.lastPhotoVerifiedAt").isNotEmpty());
    mvc.perform(get("/api/v1/boxes/{id}/photo", boxId)).andExpect(status().isOk());

    String correction = mvc.perform(multipart("/api/v1/boxes/{id}/observations", boxId)
            .file(photo).param("type", "LOCATION_ERROR").param("description", "실제 수거함 위치를 확인했습니다.")
            .param("lat", "37.551").param("lng", "126.981").param("address", "수정된 테스트 위치"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String correctionId = mapper.readTree(correction).get("id").asText();
    mvc.perform(post("/api/v1/admin/reports/{id}/approve", correctionId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/boxes/{id}", boxId))
        .andExpect(status().isOk()).andExpect(jsonPath("$.lat").value(37.551));

    String removal = mvc.perform(multipart("/api/v1/boxes/{id}/observations", boxId)
            .file(photo).param("type", "REMOVED").param("description", "현장에서 수거함이 철거됐습니다."))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String removalId = mapper.readTree(removal).get("id").asText();
    mvc.perform(post("/api/v1/admin/reports/{id}/approve", removalId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/boxes/{id}", boxId)).andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/boxes/{id}/photo", boxId)).andExpect(status().isNotFound());
  }

  @Test
  void reportApprovalNearbyConfirmationAndRemoval() throws Exception {
    mvc.perform(get("/api/v1/admin/reports"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

    String reportJson = mvc.perform(post("/api/v1/reports")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"reportType":"NEW","lat":37.5665,"lng":126.9780,
                 "address":"통합 테스트 전용 위치","description":"통합 테스트에서 생성한 임시 제보입니다."}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("PENDING"))
        .andReturn().getResponse().getContentAsString();
    String reportId = mapper.readTree(reportJson).get("id").asText();

    mvc.perform(get("/api/v1/boxes")
            .param("swLat", "37.56").param("swLng", "126.97")
            .param("neLat", "37.58").param("neLng", "126.99"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

    mvc.perform(post("/api/v1/admin/reports/{id}/approve", reportId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
    mvc.perform(post("/api/v1/admin/reports/{id}/approve", reportId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isConflict());

    String boxesJson = mvc.perform(get("/api/v1/boxes")
            .param("swLat", "37.56").param("swLng", "126.97")
            .param("neLat", "37.58").param("neLng", "126.99"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].status").value("UNVERIFIED"))
        .andReturn().getResponse().getContentAsString();
    JsonNode box = mapper.readTree(boxesJson).get(0);
    String boxId = box.get("id").asText();

    mvc.perform(get("/api/v1/boxes")
            .param("swLat", "37.56").param("swLng", "126.97")
            .param("neLat", "37.58").param("neLng", "126.99")
            .param("sourceType", "USER"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(get("/api/v1/boxes")
            .param("swLat", "37.56").param("swLng", "126.97")
            .param("neLat", "37.58").param("neLng", "126.99")
            .param("sourceType", "PUBLIC"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

    mvc.perform(get("/api/v1/boxes/nearby")
            .param("lat", "37.5665").param("lng", "126.9780")
            .param("radius", "1000").param("limit", "10"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(get("/api/v1/boxes/nearby")
            .param("lat", "37.5665").param("lng", "126.9780")
            .param("radius", "1000").param("limit", "10")
            .param("sourceType", "PUBLIC"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

    String setCookie = mvc.perform(post("/api/v1/boxes/{id}/confirmations", boxId)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"confirmationType\":\"EXISTS\"}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getHeader("Set-Cookie");
    Cookie identity = new Cookie("cloth_anon", setCookie.split(";", 2)[0].substring("cloth_anon=".length()));
    mvc.perform(post("/api/v1/boxes/{id}/confirmations", boxId)
            .cookie(identity)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"confirmationType\":\"EXISTS\"}"))
        .andExpect(status().isTooManyRequests());

    String removalJson = mvc.perform(post("/api/v1/reports")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"reportType\":\"REMOVED\",\"boxId\":\"" + boxId
                + "\",\"description\":\"통합 테스트 철거 제보입니다.\"}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString();
    String removalId = mapper.readTree(removalJson).get("id").asText();
    mvc.perform(post("/api/v1/admin/reports/{id}/approve", removalId)
            .with(httpBasic("integration-admin", "integration-password")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/boxes")
            .param("swLat", "37.56").param("swLng", "126.97")
            .param("neLat", "37.58").param("neLng", "126.99"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
  }
}
