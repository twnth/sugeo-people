package com.clothmap;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CollectionBoxRepository extends JpaRepository<CollectionBoxEntity,UUID> {}
