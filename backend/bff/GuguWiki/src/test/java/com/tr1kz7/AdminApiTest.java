package com.tr1kz7;

import com.tr1kz7.common.RedisConstants;
import com.tr1kz7.common.RequireRole;
import com.tr1kz7.DTO.Result;
import com.tr1kz7.entity.NewUser;
import com.tr1kz7.mapper.AdminMapper;
import com.tr1kz7.service.AdminService;
import com.tr1kz7.service.PasswordService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminApiTest {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String USERS_PATH = "/api/v1/admin/users";

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private StringRedisTemplate redis;
    @Autowired private PasswordService passwords;
    @Autowired private AdminMapper adminMapper;
    @Autowired private AdminService adminService;
    @Autowired @Qualifier("requestMappingHandlerMapping") private RequestMappingHandlerMapping mappings;

    private final List<String> testRedisKeys = new ArrayList<>();

    @AfterEach
    void removeTestTokens() {
        if (!testRedisKeys.isEmpty()) redis.delete(testRedisKeys);
    }

    @Test
    void anonymousCannotListUsers() throws Exception {
        mvc.perform(get(USERS_PATH).servletPath(USERS_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void readerCannotListUsers() throws Exception {
        String readerToken = tokenForNewUser("READER");
        mvc.perform(get(USERS_PATH).servletPath(USERS_PATH).header("Authorization", readerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.errorCode").doesNotExist());
    }

    @Test
    void anonymousCannotCreateUser() throws Exception {
        String email = "anonymous-" + UUID.randomUUID() + "@example.test";
        mvc.perform(post(USERS_PATH).servletPath(USERS_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserJson(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
        assertNull(adminMapper.getUserId(email));
    }

    @Test
    void readerCannotCreateUser() throws Exception {
        String readerToken = tokenForNewUser("READER");
        String email = "reader-denied-" + UUID.randomUUID() + "@example.test";
        mvc.perform(post(USERS_PATH).servletPath(USERS_PATH)
                        .header("Authorization", readerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserJson(email)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.errorCode").doesNotExist());
        assertNull(adminMapper.getUserId(email));
    }

    @Test
    void everyAdminRouteDeclaresRoleRequirement() {
        mappings.getHandlerMethods().forEach((mapping, handler) -> {
            if (mapping.getPatternValues().stream().anyMatch(path -> path.equals("/api/v1/admin") || path.startsWith("/api/v1/admin/"))) {
                RequireRole role = handler.getBeanType().getAnnotation(RequireRole.class);
                assertNotNull(role, "管理员控制器缺少 @RequireRole: " + handler);
                assertEquals("ADMIN", role.value());
            }
        });
    }

    @Test
    void adminCanListUsersWithoutPasswordHashes() throws Exception {
        String adminToken = tokenForNewUser("ADMIN");
        String readerEmail = "reader-" + UUID.randomUUID() + "@example.test";
        insertUser(readerEmail, "测试读者", "READER", "ReaderPass123");

        String body = mvc.perform(get(USERS_PATH).servletPath(USERS_PATH).header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[*].email").value(hasItem(readerEmail)))
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("passwordHash"));
        assertFalse(body.contains("password_hash"));
    }

    @Test
    void adminCanCreateUserFromJsonAndPasswordIsHashed() throws Exception {
        String adminToken = tokenForNewUser("ADMIN");
        String email = "created-" + UUID.randomUUID() + "@example.test";
        String password = "ReaderPass123";

        String body = mvc.perform(post(USERS_PATH).servletPath(USERS_PATH)
                        .header("Authorization", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"新读者\",\"email\":\"" + email
                                + "\",\"role\":\"READER\",\"initialPassword\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.email").value(email))
                .andReturn().getResponse().getContentAsString();

        assertFalse(body.contains(password));
        String savedHash = jdbc.queryForObject(
                "select password_hash from users where email = ?", String.class, email);
        assertTrue(passwords.matches(password, savedHash));
    }

    @Test
    void mapperInsertsUserAndReadsGeneratedId() {
        String email = "mapped-" + UUID.randomUUID() + "@example.test";
        adminMapper.createUser(email, "映射测试", passwords.hash("ReaderPass123"), "READER");
        assertNotNull(adminMapper.getUserId(email));
    }

    @Test
    void duplicateEmailReturnsConflict() {
        String email = "duplicate-" + UUID.randomUUID() + "@example.test";
        insertUser(email, "已有读者", "READER", "ReaderPass123");
        NewUser request = newUser(email, "另一位读者", "READER", "ReaderPass456");

        ResponseEntity<Result> response = adminService.createUser(request);
        assertEquals(409, response.getStatusCode().value());
    }

    @Test
    void shortInitialPasswordIsRejected() {
        String email = "invalid-" + UUID.randomUUID() + "@example.test";
        NewUser request = newUser(email, "短密码读者", "READER", "short");

        ResponseEntity<Result> response = adminService.createUser(request);
        assertEquals(400, response.getStatusCode().value());
        assertNull(adminMapper.getUserId(email));
    }

    private NewUser newUser(String email, String name, String role, String password) {
        NewUser user = new NewUser();
        user.setEmail(email);
        user.setName(name);
        user.setRole(role);
        user.setInitialPassword(password);
        return user;
    }

    private String createUserJson(String email) {
        return "{\"name\":\"新读者\",\"email\":\"" + email
                + "\",\"role\":\"READER\",\"initialPassword\":\"ReaderPass123\"}";
    }

    private String tokenForNewUser(String role) {
        String email = role.toLowerCase() + "-" + UUID.randomUUID() + "@example.test";
        UUID id = insertUser(email, role + "测试账号", role, "LoginPass123");
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String key = RedisConstants.LOGIN_TOKEN + token;
        redis.opsForValue().set(key, id.toString(), Duration.ofMinutes(5));
        testRedisKeys.add(key);
        return token;
    }

    private UUID insertUser(String email, String name, String role, String password) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into users (id, email, display_name, password_hash, role) values (?, ?, ?, ?, ?)",
                id, email, name, passwords.hash(password), role);
        return id;
    }
}
