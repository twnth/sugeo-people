package com.clothmap;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.mock;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class BoxApiIntegrationTest {
  @Test void invalidBoundsReturnConsistentError() throws Exception {
    MockMvc mvc = MockMvcBuilders.standaloneSetup(new BoxController(mock(JdbcTemplate.class)))
        .setControllerAdvice(new ApiExceptionHandler()).build();
    mvc.perform(get("/api/v1/boxes").param("swLat","38").param("swLng","126").param("neLat","37").param("neLng","127"))
      .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    mvc.perform(get("/api/v1/boxes").param("swLat","37.5").param("swLng","126.9").param("neLat","37.6").param("neLng","127.1").param("sourceType","UNKNOWN"))
      .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
  }
}
