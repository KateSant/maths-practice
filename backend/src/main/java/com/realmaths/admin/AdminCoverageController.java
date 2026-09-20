package com.realmaths.admin;

import com.realmaths.admin.dto.CoverageView;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reachability is decided by {@code SecurityConfig} from the {@code /api/admin/**} prefix, not
 * here, so this is protected by virtue of where it lives.
 */
@RestController
@RequestMapping("/api/admin/coverage")
public class AdminCoverageController {

    private final AdminCoverageService coverage;

    public AdminCoverageController(AdminCoverageService coverage) {
        this.coverage = coverage;
    }

    @GetMapping
    public List<CoverageView> coverage() {
        return coverage.coverage();
    }
}
