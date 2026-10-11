package com.tr1kz7.common;

import com.tr1kz7.DTO.UserDTO;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

/** 在进入标注的控制器方法前检查当前用户角色。 */
@Aspect
@Component
public class RoleAspect {

    @Before("@within(requireRole)") //@within(requireRole) 匹配带有@Require的类中的方法执行
    public void checkRole(RequireRole requireRole) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            throw new AuthorizationException(401, "请先登录。");
        }
        if (!requireRole.value().equals(user.getRole())) {
            throw new AuthorizationException(403, "当前账号没有该操作所需权限。");
        }
    }
}
