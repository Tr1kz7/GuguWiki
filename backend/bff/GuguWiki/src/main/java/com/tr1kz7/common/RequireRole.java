package com.tr1kz7.common;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记一个 Spring 组件中所有公开方法需要的登录角色。
 * */
@Target(ElementType.TYPE) //只能用在类上
@Retention(RetentionPolicy.RUNTIME)  //运行时保留注解
public @interface RequireRole {
    String value();
}
