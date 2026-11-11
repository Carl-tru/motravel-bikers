package com.destinosbikers.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebController {

    @Value("${supabase.url:}")
    private String supabaseUrl;

    @Value("${supabase.anon-key:}")
    private String supabaseAnonKey;

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("supabaseUrl", supabaseUrl);
        model.addAttribute("supabaseAnonKey", supabaseAnonKey);
        return "index";
    }
}
