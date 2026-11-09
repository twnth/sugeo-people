package com.clothmap;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/v1")
public class PublicWriteController {
  public record ReportInput(@NotNull String reportType,UUID boxId,Double lat,Double lng,@Size(max=300) String address,@NotBlank @Size(min=5,max=2000) String description) {}
  public record ConfirmationInput(@NotNull String confirmationType) {}
  private final JdbcTemplate jdbc; private final AnonymousIdentity identity; private final PhotoStorage photos;
  private final ConcurrentHashMap<String,Window> limits=new ConcurrentHashMap<>();
  record Window(long start,int count) {}
  PublicWriteController(JdbcTemplate jdbc,AnonymousIdentity identity,PhotoStorage photos) { this.jdbc=jdbc; this.identity=identity; this.photos=photos; }
  private void limit(String key,int max) {
    long now=System.currentTimeMillis(); Window next=limits.compute(key,(k,w)->w==null||now-w.start>3600000?new Window(now,1):new Window(w.start,w.count+1));
    if(next.count>max) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"잠시 후 다시 시도해주세요.");
  }
  @PostMapping("/reports") @ResponseStatus(HttpStatus.CREATED)
  public java.util.Map<String,Object> report(@Valid @RequestBody ReportInput input,HttpServletRequest req,HttpServletResponse res) {
    limit("report:"+req.getRemoteAddr(),10);
    String type=input.reportType(); if(!java.util.Set.of("NEW","REMOVED","LOCATION_ERROR").contains(type)) throw new IllegalArgumentException("제보 유형이 올바르지 않습니다.");
    if(type.equals("NEW")&&input.boxId()!=null||!type.equals("NEW")&&input.boxId()==null) throw new IllegalArgumentException("수거함 선택을 확인해주세요.");
    boolean needsPoint=!type.equals("REMOVED"); if(needsPoint) { if(input.lat()==null||input.lng()==null) throw new IllegalArgumentException("위치를 선택해주세요."); BoxController.coordinates(input.lat(),input.lng()); }
    if(input.boxId()!=null&&jdbc.queryForObject("select count(*) from collection_boxes where id=? and status <> 'REMOVED'",Integer.class,input.boxId())==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"수거함을 찾을 수 없습니다.");
    String hash=identity.hash(req,res); UUID id=UUID.randomUUID();
    if(needsPoint) jdbc.update("insert into reports(id,box_id,report_type,proposed_location,address,description,reporter_key_hash) values (?,?,?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,?,?,?)",id,input.boxId(),type,input.lng(),input.lat(),input.address(),input.description().trim(),hash);
    else jdbc.update("insert into reports(id,box_id,report_type,address,description,reporter_key_hash) values (?,?,?,?,?,?)",id,input.boxId(),type,input.address(),input.description().trim(),hash);
    return java.util.Map.of("id",id,"status","PENDING");
  }
  @PostMapping(value="/reports",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED) @Transactional(rollbackFor=Exception.class)
  public java.util.Map<String,Object> newReport(@RequestParam String reportType,@RequestParam Double lat,@RequestParam Double lng,
      @RequestParam(required=false) String address,@RequestParam String description,@RequestParam(required=false) MultipartFile photo,
      HttpServletRequest req,HttpServletResponse res) throws java.io.IOException {
    limit("report:"+req.getRemoteAddr(),10);
    if(!"NEW".equals(reportType)) throw new IllegalArgumentException("새 수거함 제보 유형이 올바르지 않습니다.");
    if(lat==null||lng==null) throw new IllegalArgumentException("지도에서 위치를 선택해주세요.");
    BoxController.coordinates(lat,lng);
    String detail=description.trim();
    if(detail.length()<5||detail.length()>2000||address!=null&&address.length()>300) throw new IllegalArgumentException("상황 설명은 5~2000자로 입력해주세요.");
    String photoKey=photo==null||photo.isEmpty()?null:photos.save(photo);
    if(photoKey!=null) org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
      @Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)try{photos.delete(photoKey);}catch(java.io.IOException ignored){}}
    });
    String hash=identity.hash(req,res); UUID id=UUID.randomUUID();
    jdbc.update("insert into reports(id,report_type,proposed_location,address,description,reporter_key_hash) values (?,?,ST_SetSRID(ST_MakePoint(?,?),4326)::geography,?,?,?)",id,"NEW",lng,lat,address,detail,hash);
    if(photoKey!=null) jdbc.update("insert into box_photos(id,report_id,s3_key,storage_type) values (?,?,?,'LOCAL')",UUID.randomUUID(),id,photoKey);
    return java.util.Map.of("id",id,"status","PENDING");
  }
  @PostMapping("/boxes/{id}/confirmations") @ResponseStatus(HttpStatus.CREATED) @Transactional
  public java.util.Map<String,Object> confirm(@PathVariable UUID id,@Valid @RequestBody ConfirmationInput input,HttpServletRequest req,HttpServletResponse res) {
    if(!java.util.Set.of("EXISTS","MISSING").contains(input.confirmationType())) throw new IllegalArgumentException("확인 유형이 올바르지 않습니다.");
    limit("confirm:"+req.getRemoteAddr(),60); String hash=identity.hash(req,res);
    jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?),hashtext(?))",id.toString(),hash);
    if(jdbc.queryForObject("select count(*) from collection_boxes where id=? and status <> 'REMOVED'",Integer.class,id)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"수거함을 찾을 수 없습니다.");
    if(jdbc.queryForObject("select count(*) from box_confirmations where box_id=? and reporter_key_hash=? and created_at>now()-interval '24 hours'",Integer.class,id,hash)>0) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"24시간 후 다시 확인할 수 있습니다.");
    jdbc.update("insert into box_confirmations(id,box_id,confirmation_type,reporter_key_hash) values (?,?,?,?)",UUID.randomUUID(),id,input.confirmationType(),hash);
    return java.util.Map.of("status","RECORDED");
  }
}
