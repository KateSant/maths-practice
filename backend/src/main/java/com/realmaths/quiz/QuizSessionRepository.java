package com.realmaths.quiz;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuizSessionRepository extends JpaRepository<QuizSession, Long> {

    /**
     * Scoped by user id as well as session id, so guessing another student's
     * session id returns 404 rather than their results.
     */
    @Query("select s from QuizSession s where s.id = :id and s.user.id = :userId")
    Optional<QuizSession> findByIdForUser(@Param("id") Long id, @Param("userId") Long userId);

    @Query("""
            select s from QuizSession s
            left join fetch s.topic
            where s.user.id = :userId and s.completedAt is not null
            order by s.completedAt desc
            """)
    List<QuizSession> findCompletedForUser(@Param("userId") Long userId);

    long countByUserIdAndCompletedAtIsNotNull(Long userId);
}
