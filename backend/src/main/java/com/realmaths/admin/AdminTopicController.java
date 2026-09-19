package com.realmaths.admin;

import com.realmaths.admin.dto.AdminTopicView;
import com.realmaths.admin.dto.SaveTopicRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/topics")
public class AdminTopicController {

    private final AdminTopicService topics;

    public AdminTopicController(AdminTopicService topics) {
        this.topics = topics;
    }

    @GetMapping
    public List<AdminTopicView> list() {
        return topics.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminTopicView create(@Valid @RequestBody SaveTopicRequest request) {
        return topics.create(request);
    }

    @PutMapping("/{id}")
    public AdminTopicView update(@PathVariable long id, @Valid @RequestBody SaveTopicRequest request) {
        return topics.update(id, request);
    }
}
