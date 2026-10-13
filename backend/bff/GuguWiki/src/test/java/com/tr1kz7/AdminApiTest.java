package com.tr1kz7;

import com.jayway.jsonpath.JsonPath;
import com.tr1kz7.common.RedisConstants;
import com.tr1kz7.common.RequireRole;
import com.tr1kz7.common.UserHolder;
import com.tr1kz7.mapper.AdminMapper;
import com.tr1kz7.service.PasswordService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 接口文档第 1 组「认证」和第 2 组「用户与授权管理」的集成测试。
 * <p>第 1 组覆盖登录、恢复登录、退出登录、参数与密码校验、入口权限、禁用账号、
 * Redis Token 保存/续期/失效和请求结束后的 ThreadLocal 清理。</p>
 * <p>第 2 组覆盖创建和列出用户、未登录/读者权限限制、重复邮箱、初始密码长度、
 * BCrypt 存储和响应中的密码信息保护；另保留 Mapper UUID 映射检查。</p>
 * <p>加载真实 Spring 上下文，通过 MockMvc 执行 MVC 请求并访问本地 PostgreSQL、Redis。
 * 管理员接口使用真实登录返回的 Token。数据库写入随事务回滚，Redis 测试 Key 在每例后清理。
 * Token 有效期按当前 {@link RedisConstants#LOGIN_TOKEN_TTL} 配置校验。</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminApiTest {

    private static final String LOGIN_PATH = "/api/v1/auth/login";
    private static final String ME_PATH = "/api/v1/auth/me";
    private static final String LOGOUT_PATH = "/api/v1/auth/logout";
    private static final String TEST_PASSWORD = "LoginPass123";
    private static final String USERS_PATH = "/api/v1/admin/users";

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private StringRedisTemplate redis;
    @Autowired private PasswordService passwords;
    @Autowired private AdminMapper adminMapper;
    @Autowired @Qualifier("requestMappingHandlerMapping") private RequestMappingHandlerMapping mappings;

    private final List<String> testRedisKeys = new ArrayList<>();

    /** 删除测试登录产生的 Redis Key，并清理当前线程身份，避免测试间状态残留。 */
    @AfterEach
    void removeTestTokens() {
        if (!testRedisKeys.isEmpty()) redis.delete(testRedisKeys);
        UserHolder.removeUser();
    }

    // 第 1 组：认证。

    /** 测试 1.1：读者正确登录后返回随机 Token，Redis 仅保存用户 ID 并设置配置要求的 TTL。 */
    @Test
    void readerCanLoginAndStoresRedisUserId() throws Exception {
        String email = uniqueEmail("reader-login");
        UUID id = insertUser(email, "登录读者", "READER", TEST_PASSWORD);
        String token = login(email, TEST_PASSWORD, "READER");
        assertTrue(token.matches("[A-Za-z0-9_-]{43}"));
        assertEquals(id.toString(), redis.opsForValue().get(RedisConstants.LOGIN_TOKEN + token));
        assertTokenTtl(token);
    }

    /** 测试 1.1：ADMIN 账号可以从管理员入口登录，返回服务端的 ADMIN 角色。 */
    @Test
    void adminCanLoginThroughAdminEntry() throws Exception {
        String email = uniqueEmail("admin-login");
        insertUser(email, "登录管理员", "ADMIN", TEST_PASSWORD);
        login(email, TEST_PASSWORD, "ADMIN");
    }

    /** 测试 1.1：管理员从 READER 入口登录仍是 ADMIN，登录入口不会修改账号角色。 */
    @Test
    void adminCanLoginThroughReaderEntry() throws Exception {
        String email = uniqueEmail("admin-reader-entry");
        insertUser(email, "读者入口管理员", "ADMIN", TEST_PASSWORD);
        login(email, TEST_PASSWORD, "READER");
    }

    /** 测试 1.1：缺少邮箱、密码、入口或使用非法入口时返回 400，不签发 Token。 */
    @Test
    void loginRejectsInvalidParameters() throws Exception {
        List<String> bodies = List.of(
                "{}",
                "{\"email\":\"\",\"password\":\"LoginPass123\",\"entry\":\"READER\"}",
                "{\"email\":\"reader@example.test\",\"password\":\"\",\"entry\":\"READER\"}",
                "{\"email\":\"reader@example.test\",\"password\":\"LoginPass123\"}",
                "{\"email\":\"reader@example.test\",\"password\":\"LoginPass123\",\"entry\":\"OWNER\"}");
        for (String body : bodies) expectLoginFailure(body, 400);
    }

    /** 测试 1.1：真实账号提交错误密码返回 401，不签发 Token。 */
    @Test
    void loginRejectsWrongPassword() throws Exception {
        String email = uniqueEmail("wrong-password");
        insertUser(email, "密码校验读者", "READER", TEST_PASSWORD);
        expectLoginFailure(loginJson(email, "WrongPass456", "READER"), 401);
    }

    /** 测试 1.1：不存在的账号登录返回 401，不签发 Token。 */
    @Test
    void loginRejectsUnknownAccount() throws Exception {
        expectLoginFailure(loginJson(uniqueEmail("unknown"), TEST_PASSWORD, "READER"), 401);
    }

    /** 测试 1.1：禁用账号即使密码正确也返回 401，不签发 Token。 */
    @Test
    void loginRejectsDisabledAccount() throws Exception {
        String email = uniqueEmail("disabled-login");
        UUID id = insertUser(email, "禁用读者", "READER", TEST_PASSWORD);
        jdbc.update("update users set enabled = false where id = ?", id);
        expectLoginFailure(loginJson(email, TEST_PASSWORD, "READER"), 401);
    }

    /** 测试 1.1：READER 账号请求 ADMIN 入口返回 403，不能通过登录参数提升权限。 */
    @Test
    void readerCannotLoginThroughAdminEntry() throws Exception {
        String email = uniqueEmail("reader-admin-entry");
        insertUser(email, "普通读者", "READER", TEST_PASSWORD);
        expectLoginFailure(loginJson(email, TEST_PASSWORD, "ADMIN"), 403);
    }

    /** 测试 1.2：有效 Token 恢复完整用户信息并续期，响应不含密码信息，请求完成后清理线程身份。 */
    @Test
    void meRestoresUserAndRenewsToken() throws Exception {
        String email = uniqueEmail("restore");
        UUID id = insertUser(email, "恢复登录读者", "READER", TEST_PASSWORD);
        String token = login(email, TEST_PASSWORD, "READER");
        assertTrue(Boolean.TRUE.equals(redis.expire(RedisConstants.LOGIN_TOKEN + token, Duration.ofMinutes(1))));
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(id.toString()))
                .andExpect(jsonPath("$.data.name").value("恢复登录读者"))
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.role").value("READER"))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data.password_hash").doesNotExist())
                .andExpect(jsonPath("$.errorCode").doesNotExist());
        assertTokenTtl(token);
        assertNull(UserHolder.getUser());
    }

    /** 测试 1.2：未携带 Token 返回 401，不能沿用前一次已登录请求的身份。 */
    @Test
    void meRejectsMissingToken() throws Exception {
        String token = tokenForNewUser("READER");
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get(ME_PATH).servletPath(ME_PATH))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        assertNull(UserHolder.getUser());
    }

    /** 测试 1.2：格式非法的 Token 无法恢复登录，返回 401。 */
    @Test
    void meRejectsMalformedToken() throws Exception {
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", "invalid-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
    }

    /** 测试 1.2：将 Redis 会话立即过期后，原先合法的 Token 也不能恢复登录。 */
    @Test
    void meRejectsExpiredRedisSession() throws Exception {
        String token = tokenForNewUser("READER");
        assertTrue(Boolean.TRUE.equals(redis.expire(RedisConstants.LOGIN_TOKEN + token, Duration.ZERO)));
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", token))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
    }

    /** 测试 1.2：账号登录后被禁用，恢复请求返回 401，并删除对应 Redis 登录态。 */
    @Test
    void disabledAccountCannotRestoreSession() throws Exception {
        String email = uniqueEmail("disabled-session");
        UUID id = insertUser(email, "登录后禁用读者", "READER", TEST_PASSWORD);
        String token = login(email, TEST_PASSWORD, "READER");
        jdbc.update("update users set enabled = false where id = ?", id);
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", token))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        assertFalse(Boolean.TRUE.equals(redis.hasKey(RedisConstants.LOGIN_TOKEN + token)));
        assertNull(UserHolder.getUser());
    }

    /** 测试 1.3：退出返回无响应体的 204 并删除 Token，随后恢复登录或再次退出均返回 401。 */
    @Test
    void logoutDeletesTokenAndPreventsReuse() throws Exception {
        String token = tokenForNewUser("READER");
        mvc.perform(post(LOGOUT_PATH).servletPath(LOGOUT_PATH).header("Authorization", token))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertFalse(Boolean.TRUE.equals(redis.hasKey(RedisConstants.LOGIN_TOKEN + token)));
        assertNull(UserHolder.getUser());
        mvc.perform(get(ME_PATH).servletPath(ME_PATH).header("Authorization", token))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        mvc.perform(post(LOGOUT_PATH).servletPath(LOGOUT_PATH).header("Authorization", token))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
    }

    /** 测试 1.3：未登录请求退出接口返回 401。 */
    @Test
    void anonymousCannotLogout() throws Exception {
        mvc.perform(post(LOGOUT_PATH).servletPath(LOGOUT_PATH))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
    }

    /** 测试 1.3：格式非法的 Token 请求退出接口返回 401。 */
    @Test
    void malformedTokenCannotLogout() throws Exception {
        mvc.perform(post(LOGOUT_PATH).servletPath(LOGOUT_PATH).header("Authorization", "invalid-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
    }

    // 第 2 组：用户与授权管理。

    /** 测试 2.2：未登录用户查询用户列表返回 401。 */
    @Test
    void anonymousCannotListUsers() throws Exception {
        mvc.perform(get(USERS_PATH).servletPath(USERS_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    /** 测试 2.2：真实登录取得的 READER Token 查询用户列表返回 403。 */
    @Test
    void readerCannotListUsers() throws Exception {
        String readerToken = tokenForNewUser("READER");
        mvc.perform(get(USERS_PATH).servletPath(USERS_PATH).header("Authorization", readerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.errorCode").doesNotExist());
    }

    /** 测试 2.1：未登录用户创建账号返回 401，数据库不会插入目标用户。 */
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

    /** 测试 2.1：READER Token 创建账号返回 403，数据库不会插入目标用户。 */
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

    /** 测试第 2 组权限声明：所有管理员路由所在的控制器必须声明 ADMIN 角色要求。 */
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

    /** 测试 2.2：ADMIN Token 可列出用户，响应包含目标邮箱但不暴露密码哈希。 */
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

    /** 测试 2.1 和 1.1：创建用户存储 BCrypt 哈希，响应无密码，新账号可用初始密码登录。 */
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
        assertNotNull(savedHash);
        assertTrue(savedHash.startsWith("$2"));
        assertFalse(body.contains(savedHash));
        assertFalse(body.contains("passwordHash"));
        assertFalse(body.contains("password_hash"));
        login(email, password, "READER");
    }

    /** 补充第 2 组的数据访问测试：Mapper 创建用户后可正确读取数据库生成的 UUID。 */
    @Test
    void mapperInsertsUserAndReadsGeneratedId() {
        String email = "mapped-" + UUID.randomUUID() + "@example.test";
        adminMapper.createUser(email, "映射测试", passwords.hash("ReaderPass123"), "READER");
        assertNotNull(adminMapper.getUserId(email));
    }

    /** 测试 2.1：管理员创建同邮箱（大小写不同）账号返回 409，原账号保持唯一。 */
    @Test
    void duplicateEmailReturnsConflict() throws Exception {
        String token = tokenForNewUser("ADMIN");
        String email = "duplicate-" + UUID.randomUUID() + "@example.test";
        insertUser(email, "已有读者", "READER", "ReaderPass123");
        mvc.perform(post(USERS_PATH).servletPath(USERS_PATH).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserJson(email.toUpperCase(java.util.Locale.ROOT))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.errorCode").doesNotExist());
        assertEquals(1, jdbc.queryForObject("select count(*) from users where lower(email) = lower(?)", Integer.class, email));
    }

    /** 测试 2.1：管理员提交不足 8 位的初始密码返回 400，数据库不会插入目标用户。 */
    @Test
    void shortInitialPasswordIsRejected() throws Exception {
        String token = tokenForNewUser("ADMIN");
        String email = "invalid-" + UUID.randomUUID() + "@example.test";
        mvc.perform(post(USERS_PATH).servletPath(USERS_PATH).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createUserJson(email).replace("ReaderPass123", "short")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.errorCode").doesNotExist());
        assertNull(adminMapper.getUserId(email));
    }

    /** 辅助方法：执行真实登录并检查 HTTP、用户字段和密码保护，登记成功 Token 供测试后清理。 */
    private String login(String email, String password, String entry) throws Exception {
        MvcResult result = mvc.perform(post(LOGIN_PATH).servletPath(LOGIN_PATH)
                        .contentType(MediaType.APPLICATION_JSON).content(loginJson(email, password, entry))).andReturn();
        String body = result.getResponse().getContentAsString();
        String token = JsonPath.read(body, "$.token");
        // 先登记再断言，避免断言失败时留下已创建的 Redis 登录态。
        if (token != null) testRedisKeys.add(RedisConstants.LOGIN_TOKEN + token);
        assertEquals(200, result.getResponse().getStatus());
        assertEquals(200, (int) JsonPath.read(body, "$.code"));
        assertNotNull(token);
        assertEquals(adminMapper.getUserId(email).toString(), JsonPath.read(body, "$.data.id"));
        assertEquals(jdbc.queryForObject("select display_name from users where lower(email) = lower(?)", String.class, email),
                JsonPath.read(body, "$.data.name"));
        assertEquals(email, JsonPath.read(body, "$.data.email"));
        assertEquals(jdbc.queryForObject("select role from users where lower(email) = lower(?)", String.class, email),
                JsonPath.read(body, "$.data.role"));
        assertFalse(body.contains(password));
        assertFalse(body.contains("passwordHash"));
        assertFalse(body.contains("password_hash"));
        assertFalse(body.contains("errorCode"));
        return token;
    }

    /** 辅助方法：验证失败登录的 HTTP 状态与 code 一致，并且不返回 Token 或 errorCode。 */
    private void expectLoginFailure(String body, int expectedStatus) throws Exception {
        mvc.perform(post(LOGIN_PATH).servletPath(LOGIN_PATH).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is(expectedStatus)).andExpect(jsonPath("$.code").value(expectedStatus))
                .andExpect(jsonPath("$.data").isEmpty()).andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.errorCode").doesNotExist());
    }

    /** 辅助方法：检查 Token 的 Redis TTL 与当前配置一致，允许 5 秒测试执行误差。 */
    private void assertTokenTtl(String token) {
        Long ttl = redis.getExpire(RedisConstants.LOGIN_TOKEN + token, TimeUnit.SECONDS);
        long expected = TimeUnit.MINUTES.toSeconds(RedisConstants.LOGIN_TOKEN_TTL);
        assertNotNull(ttl);
        assertTrue(ttl > 0 && ttl <= expected && ttl >= expected - 5, "Token TTL 应与 LOGIN_TOKEN_TTL 配置一致");
    }

    /** 辅助方法：构造第 1.1 登录接口的邮箱、明文密码和入口 JSON，仅用于本类固定测试数据。 */
    private String loginJson(String email, String password, String entry) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"entry\":\"" + entry + "\"}";
    }

    /** 辅助方法：构造第 2.1 创建读者接口所需的姓名、邮箱、角色和初始密码 JSON。 */
    private String createUserJson(String email) {
        return "{\"name\":\"新读者\",\"email\":\"" + email
                + "\",\"role\":\"READER\",\"initialPassword\":\"ReaderPass123\"}";
    }

    /** 辅助方法：插入指定角色的账号，通过第 1.1 登录接口获取真实 Token，而不是直接写 Redis。 */
    private String tokenForNewUser(String role) throws Exception {
        String email = role.toLowerCase() + "-" + UUID.randomUUID() + "@example.test";
        insertUser(email, role + "测试账号", role, TEST_PASSWORD);
        return login(email, TEST_PASSWORD, role);
    }

    /** 辅助方法：生成唯一测试邮箱，避免与已有账号或其他用例冲突。 */
    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.test";
    }

    /** 辅助方法：插入 BCrypt 密码哈希的测试账号；数据库写入在每例结束后由事务回滚。 */
    private UUID insertUser(String email, String name, String role, String password) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into users (id, email, display_name, password_hash, role) values (?, ?, ?, ?, ?)",
                id, email, name, passwords.hash(password), role);
        return id;
    }
}
