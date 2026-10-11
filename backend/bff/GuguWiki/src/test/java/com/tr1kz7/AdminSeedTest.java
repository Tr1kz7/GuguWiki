package com.tr1kz7;

import com.tr1kz7.service.PasswordService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Locale;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 手动运行一次，为本地开发数据库创建首个管理员。普通测试不会执行。 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@EnabledIfEnvironmentVariable(named = "GUGUWIKI_SEED_ADMIN", matches = "true")
class AdminSeedTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordService passwords;

    @Test
    void createInitialAdmin() {
        String email = System.getenv("GUGUWIKI_SEED_ADMIN_EMAIL");
        String password = System.getenv("GUGUWIKI_SEED_ADMIN_PASSWORD");
        if (email == null || email.isBlank() || !email.contains("@")
                || password == null || password.length() < 8) {
            throw new IllegalStateException("请提供管理员邮箱和至少 8 位密码。");
        }

        Integer adminCount = jdbc.queryForObject(
                "select count(*) from users where role = 'ADMIN'", Integer.class);
        if (adminCount != null && adminCount > 0) {
            throw new IllegalStateException("数据库已有管理员；不会重复创建。");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        jdbc.update("insert into users (id, email, display_name, password_hash, role) values (?, ?, ?, ?, 'ADMIN')",
                UUID.randomUUID(), normalizedEmail, "管理员", passwords.hash(password));

        String savedHash = jdbc.queryForObject(
                "select password_hash from users where lower(email) = ?", String.class, normalizedEmail);
        assertTrue(savedHash.startsWith("$2"));
        assertTrue(passwords.matches(password, savedHash));
        assertEquals(1, jdbc.queryForObject("select count(*) from users where role = 'ADMIN'", Integer.class));
    }
}
