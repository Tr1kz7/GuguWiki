package com.tr1kz7.entity;

import lombok.Getter;
import lombok.Setter;

/**
 * 管理员创建用户接收参数
 */

@Getter
@Setter
public class NewUser {
    private String name;
    private String email;
    private String role;
    private String initialPassword;
}
