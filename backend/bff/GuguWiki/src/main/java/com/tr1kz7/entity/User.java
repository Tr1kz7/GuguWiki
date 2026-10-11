package com.tr1kz7.entity;

import lombok.Data;

/**
 * 用来接收前端传递的登陆用户信息
 */
@Data
public class User {
    private String email;
    private String password;
    private String entry;
}
