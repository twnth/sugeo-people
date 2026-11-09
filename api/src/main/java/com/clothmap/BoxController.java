package com.clothmap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/boxes")
public class BoxController {
  private final JdbcTemplate jdbc;
  public BoxController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  public record Box(UUID id,String name,String address,String districtCode,double lat,double lng,String sourceType,String status,String lastVerifiedAt,String lastPhotoVerifiedAt,String sourceAsOf) {}
  static String instant(ResultSet rs,String column) throws SQLException { var value=rs.getTimestamp(column); return value==null?null:value.toInstant().toString(); }
  static final RowMapper<Box> BOX=(rs,n)->new Box(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("address"),rs.getString("district_code"),rs.getDouble("lat"),rs.getDouble("lng"),rs.getString("source_type"),rs.getString("status"),instant(rs,"last_verified_at"),instant(rs,"last_photo_verified_at"),rs.getString("source_as_of"));
  static final String SELECT="select id,name,address,district_code,ST_Y(location::geometry) lat,ST_X(location::geometry) lng,source_type,status,last_verified_at,last_photo_verified_at,source_as_of from collection_boxes ";
  static void coordinates(double lat,double lng) { if (!Double.isFinite(lat)||!Double.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180) throw new IllegalArgumentException("위도·경도 범위를 확인해주세요."); }
  static String source(String sourceType) {
    if(sourceType==null || sourceType.isBlank()) return null;
    if(!java.util.Set.of("PUBLIC","USER").contains(sourceType)) throw new IllegalArgumentException("출처가 올바르지 않습니다.");
    return sourceType;
  }
  @GetMapping public List<Box> bounds(@RequestParam double swLat,@RequestParam double swLng,@RequestParam double neLat,@RequestParam double neLng,@RequestParam(required=false) String sourceType) {
    coordinates(swLat,swLng); coordinates(neLat,neLng);
    if(swLat>=neLat||swLng>=neLng||neLat-swLat>2||neLng-swLng>2) throw new IllegalArgumentException("지도 영역이 올바르지 않거나 너무 넓습니다.");
    String selectedSource=source(sourceType);
    return jdbc.query(SELECT+"where status <> 'REMOVED' and (cast(? as text) is null or source_type=?) and location && ST_MakeEnvelope(?,?,?, ?,4326)::geography order by created_at desc limit 500",BOX,selectedSource,selectedSource,swLng,swLat,neLng,neLat);
  }
  @GetMapping("/nearby") public List<Box> nearby(@RequestParam double lat,@RequestParam double lng,@RequestParam(defaultValue="1000") int radius,@RequestParam(defaultValue="50") int limit,@RequestParam(required=false) String sourceType) {
    coordinates(lat,lng); if(radius<1||radius>5000||limit<1||limit>100) throw new IllegalArgumentException("검색 반경 또는 개수가 올바르지 않습니다.");
    String selectedSource=source(sourceType);
    return jdbc.query(SELECT+"where status <> 'REMOVED' and (cast(? as text) is null or source_type=?) and ST_DWithin(location,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,?) order by ST_Distance(location,ST_SetSRID(ST_MakePoint(?,?),4326)::geography) limit ?",BOX,selectedSource,selectedSource,lng,lat,radius,lng,lat,limit);
  }
  @GetMapping("/{id}") public Box one(@PathVariable UUID id) {
    return jdbc.query(SELECT+"where id=? and status <> 'REMOVED'",BOX,id).stream().findFirst().orElseThrow(()->new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND,"수거함을 찾을 수 없습니다."));
  }
}
