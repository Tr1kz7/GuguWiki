package com.tr1kz7.config;


import com.tr1kz7.common.LoginInterceptor;
import com.tr1kz7.common.RefreshTokenInterceptor;
import com.tr1kz7.mapper.AuthMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 加载拦截器
 * */
@Configuration
public class MvcConfig implements WebMvcConfigurer {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private AuthMapper authMapper;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        //刷新登陆状态ttl
        registry.addInterceptor(new RefreshTokenInterceptor(stringRedisTemplate, authMapper))
                .addPathPatterns("/api/**").order(0);
        //拦截未登录用户的可访问页面
        registry.addInterceptor(new LoginInterceptor())
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/v1/auth/login"
                ).order(1);
    }

}
