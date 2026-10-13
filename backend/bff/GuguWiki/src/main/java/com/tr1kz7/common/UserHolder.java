package com.tr1kz7.common;

import com.tr1kz7.DTO.UserDTO;

/**
 * 将用户信息保存在ThreadLocal
 */
public class UserHolder {
    private static final ThreadLocal<UserDTO> tl = new ThreadLocal<>();

    public static void saveUser(UserDTO user){
        tl.set(user);
    }

    public static UserDTO getUser(){
        return tl.get();
    }

    public static void removeUser(){
        tl.remove();
    }
}
