package com.clothmap;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/v1/admin")
public class AdminController {
  private final JdbcTemplate jdbc;
  AdminController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  @GetMapping("/me") public Map<String,String> me(Authentication auth) { return Map.of("username",auth.getName()); }
  private final org.springframework.jdbc.core.RowMapper<Map<String,Object>> REPORT=(rs,n)->Map.of(
    "id",rs.getObject("id"),"reportType",rs.getString("report_type"),"boxId",rs.getString("box_id")==null?"":rs.getString("box_id"),
    "lat",rs.getObject("lat")==null?"":rs.getObject("lat"),"lng",rs.getObject("lng")==null?"":rs.getObject("lng"),
    "address",rs.getString("address")==null?"":rs.getString("address"),"description",rs.getString("description"),
    "status",rs.getString("status"),"createdAt",rs.getString("created_at"),"hasPhoto",rs.getBoolean("has_photo"));
  private static final String QUERY="select id,report_type,box_id,ST_Y(proposed_location::geometry) lat,ST_X(proposed_location::geometry) lng,address,description,status,created_at,exists(select 1 from box_photos where report_id=reports.id) has_photo from reports ";
  @GetMapping("/reports") public List<Map<String,Object>> reports(@RequestParam(defaultValue="PENDING") String status) {
    if(!java.util.Set.of("PENDING","APPROVED","REJECTED").contains(status)) throw new IllegalArgumentException("상태가 올바르지 않습니다.");
    return jdbc.query(QUERY+"where status=? order by created_at asc limit 100",REPORT,status);
  }
  @GetMapping("/reports/{id}") public Map<String,Object> one(@PathVariable UUID id) {
    return jdbc.query(QUERY+"where id=?",REPORT,id).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
  }
  @PostMapping("/reports/{id}/approve") @Transactional
  public Map<String,String> approve(@PathVariable UUID id,Authentication auth) {
    var report=one(id); if(!"PENDING".equals(report.get("status"))) throw new IllegalStateException("이미 처리된 제보입니다.");
    UUID adminId=jdbc.queryForObject("select id from admin_users where username=?",UUID.class,auth.getName());
    int updated=jdbc.update("update reports set status='APPROVED',reviewed_by=?,reviewed_at=now() where id=? and status='PENDING'",adminId,id);
    if(updated!=1) throw new IllegalStateException("이미 처리된 제보입니다.");
    String type=(String)report.get("reportType");
    int changed;
    if(type.equals("NEW")) changed=jdbc.update("insert into collection_boxes(id,name,address,location,source_type,status) values (?, '사용자 제보 수거함',?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,'USER','UNVERIFIED')",UUID.randomUUID(),report.get("address"),report.get("lng"),report.get("lat"));
    else if(type.equals("EXISTS")) changed=jdbc.update("update collection_boxes set status='ACTIVE',last_verified_at=now(),last_photo_verified_at=now(),updated_at=now() where id=? and status <> 'REMOVED'",UUID.fromString((String)report.get("boxId")));
    else if(type.equals("REMOVED")) changed=jdbc.update("update collection_boxes set status='REMOVED',updated_at=now() where id=? and status <> 'REMOVED'",UUID.fromString((String)report.get("boxId")));
    else changed=jdbc.update("update collection_boxes set location=ST_SetSRID(ST_MakePoint(?,?),4326)::geography,address=coalesce(nullif(?,''),address),status='ACTIVE',last_verified_at=now(),last_photo_verified_at=case when ? then now() else last_photo_verified_at end,updated_at=now() where id=? and status <> 'REMOVED'",report.get("lng"),report.get("lat"),report.get("address"),report.get("hasPhoto"),UUID.fromString((String)report.get("boxId")));
    if(changed!=1) throw new IllegalStateException("수거함 상태가 변경되어 제보를 승인할 수 없습니다.");
    return Map.of("status","APPROVED");
  }
  @PostMapping("/reports/{id}/reject") @Transactional
  public Map<String,String> reject(@PathVariable UUID id,Authentication auth) {
    UUID adminId=jdbc.queryForObject("select id from admin_users where username=?",UUID.class,auth.getName());
    if(jdbc.update("update reports set status='REJECTED',reviewed_by=?,reviewed_at=now() where id=? and status='PENDING'",adminId,id)!=1) throw new IllegalStateException("이미 처리된 제보입니다.");
    return Map.of("status","REJECTED");
  }
  public record BoxPatch(@NotNull String status) {}
  @PatchMapping("/boxes/{id}") public Map<String,String> patch(@PathVariable UUID id,@Valid @RequestBody BoxPatch input) {
    if(!java.util.Set.of("ACTIVE","UNVERIFIED","SUSPECTED_REMOVED","REMOVED").contains(input.status())) throw new IllegalArgumentException("상태가 올바르지 않습니다.");
    if(jdbc.update("update collection_boxes set status=?,updated_at=now() where id=?",input.status(),id)!=1) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return Map.of("status",input.status());
  }
}
