package com.clothmap;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="collection_boxes")
public class CollectionBoxEntity {
  @Id private UUID id;
  private String name;
  private String address;
  @Column(name="district_code") private String districtCode;
  @Column(name="source_type") private String sourceType;
  private String status;
  @Column(name="last_verified_at") private Instant lastVerifiedAt;
  @Column(name="created_at") private Instant createdAt;
  @Column(name="updated_at") private Instant updatedAt;
  protected CollectionBoxEntity() {}
  public UUID getId() { return id; }
  public String getName() { return name; }
}
