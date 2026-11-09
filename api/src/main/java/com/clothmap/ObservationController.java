package com.clothmap;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class ObservationController {
  private final JdbcTemplate jdbc;
  private final AnonymousIdentity identity;
  private final PhotoStorage photos;
  private final ConcurrentHashMap<String, Window> limits = new ConcurrentHashMap<>();
  private record Window(long start, int count) {}

  ObservationController(JdbcTemplate jdbc, AnonymousIdentity identity, PhotoStorage photos) {
    this.jdbc = jdbc;
    this.identity = identity;
    this.photos = photos;
  }

  @PostMapping(value = "/boxes/{id}/observations", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @Transactional(rollbackFor = Exception.class)
  public ResponseEntity<Map<String, Object>> observe(
      @PathVariable UUID id,
      @RequestParam String type,
      @RequestParam String description,
      @RequestParam(required = false) Double lat,
      @RequestParam(required = false) Double lng,
      @RequestParam(required = false) String address,
      @RequestParam MultipartFile photo,
      HttpServletRequest request,
      HttpServletResponse response) throws IOException {
    if (!Set.of("EXISTS", "REMOVED", "LOCATION_ERROR").contains(type)) {
      throw new IllegalArgumentException("현장 확인 유형이 올바르지 않습니다.");
    }
    String detail = description.trim();
    if (detail.length() < 5 || detail.length() > 1000 || address != null && address.length() > 300) {
      throw new IllegalArgumentException("설명은 5~1000자로 입력해주세요.");
    }
    if ((lat == null) != (lng == null) || type.equals("LOCATION_ERROR") && lat == null) {
      throw new IllegalArgumentException("변경할 위치를 선택해주세요.");
    }
    if (lat != null) BoxController.coordinates(lat, lng);
    String hash = identity.hash(request, response);
    long now = System.currentTimeMillis();
    String limitKey = "observation:" + request.getRemoteAddr();
    Window window = limits.compute(limitKey, (key, old) -> old == null || now - old.start > 3_600_000
        ? new Window(now, 1) : new Window(old.start, old.count + 1));
    if (window.count > 10) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 시도해주세요.");
    jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?),hashtext(?))", id.toString(), hash);
    Integer count = jdbc.queryForObject("select count(*) from collection_boxes where id=? and status <> 'REMOVED'", Integer.class, id);
    if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "수거함을 찾을 수 없습니다.");
    Integer recent = jdbc.queryForObject("select count(*) from reports where box_id=? and reporter_key_hash=? and report_type=? and created_at>now()-interval '24 hours'", Integer.class, id, hash, type);
    if (recent != null && recent > 0) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "같은 수거함은 24시간 후 다시 확인할 수 있습니다.");
    String photoKey = photos.save(photo);
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override public void afterCompletion(int status) {
        if (status != STATUS_COMMITTED) {
          try { photos.delete(photoKey); } catch (IOException ignored) { }
        }
      }
    });
    UUID reportId = UUID.randomUUID();
    if (lat == null) {
      jdbc.update("insert into reports(id,box_id,report_type,address,description,reporter_key_hash) values (?,?,?,?,?,?)",
          reportId, id, type, address, detail, hash);
    } else {
      jdbc.update("insert into reports(id,box_id,report_type,proposed_location,address,description,reporter_key_hash) values (?,?,?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,?,?,?)",
          reportId, id, type, lng, lat, address, detail, hash);
    }
    jdbc.update("insert into box_photos(id,box_id,report_id,s3_key,storage_type) values (?,?,?,?,'LOCAL')",
        UUID.randomUUID(), id, reportId, photoKey);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", reportId, "status", "PENDING"));
  }

  @GetMapping("/admin/reports/{id}/photo")
  public ResponseEntity<byte[]> adminPhoto(@PathVariable UUID id) throws IOException {
    String key = jdbc.query("select s3_key from box_photos where report_id=? order by created_at desc limit 1",
        rs -> rs.next() ? rs.getString(1) : null, id);
    if (key == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "사진을 찾을 수 없습니다.");
    return image(photos.read(key));
  }

  @GetMapping("/boxes/{id}/photo")
  public ResponseEntity<byte[]> publicPhoto(@PathVariable UUID id) throws IOException {
    String key = jdbc.query("""
        select p.s3_key from box_photos p
        join reports r on r.id=p.report_id
        join collection_boxes b on b.id=p.box_id
        where p.box_id=? and r.status='APPROVED' and r.report_type in ('EXISTS','LOCATION_ERROR')
          and b.status <> 'REMOVED'
        order by r.reviewed_at desc limit 1
        """, rs -> rs.next() ? rs.getString(1) : null, id);
    if (key == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공개된 사진을 찾을 수 없습니다.");
    return image(photos.read(key));
  }

  private ResponseEntity<byte[]> image(byte[] bytes) {
    return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(CacheControl.noStore()).body(bytes);
  }
}
