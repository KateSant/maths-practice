package com.realmaths.question;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TopicRepository extends JpaRepository<Topic, Long> {

    List<Topic> findAllByOrderBySortOrderAsc();

    Optional<Topic> findBySlugIgnoreCase(String slug);
}
