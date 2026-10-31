-- Nexus Hub X — ตัวอย่างฝั่งเกม: ตรวจคีย์ตอนเริ่ม + heartbeat เตะผู้เล่นทันทีเมื่อคีย์ถูกลบ/ระงับ/หมดอายุ
-- แก้ BASE ให้เป็นโดเมนเว็บของคุณ แล้วเอาส่วน "Heartbeat" ไปต่อท้ายสคริปต์หลักได้เลย

local BASE = "https://api-nexus-hub7.vercel.app"
local KEY  = getgenv().NEXUS_KEY or script_key  -- คีย์ที่ผู้ใช้ใส่

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local LP = Players.LocalPlayer

local httpRequest = (syn and syn.request) or (http and http.request) or http_request or request
local function getHwid()
    local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
    return ok and id or "unknown"
end
local HWID = (gethwid and gethwid()) or getHwid()

local function call(path, query)
    local url = BASE .. path .. "?" .. query
    local ok, res = pcall(httpRequest, { Url = url, Method = "GET" })
    if not ok or not res or not res.Body then return nil end
    local ok2, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
    return ok2 and data or nil
end

local function kick(msg)
    LP:Kick("\n[Nexus Hub X]\n" .. tostring(msg or "คีย์ของคุณใช้งานไม่ได้แล้ว"))
end

-- 1) ตรวจคีย์ตอนเริ่ม (ผูกเครื่อง + เริ่มนับเวลาครั้งแรก)
local q = ("key=%s&hwid=%s&roblox_id=%d&roblox_name=%s"):format(
    KEY, HttpService:UrlEncode(HWID), LP.UserId, HttpService:UrlEncode(LP.Name))
local v = call("/api/keys/verify", q)
if not v or not v.valid then
    return kick(v and v.message or "เชื่อมต่อเซิร์ฟเวอร์คีย์ไม่ได้")
end

-- 2) Heartbeat: เช็กทุก ~10 วินาที — เจอ kick=true = โดนลบ/ระงับ/หมดอายุ/ผิดเครื่อง → เตะทันที
task.spawn(function()
    local fails = 0
    while task.wait(10) do
        local h = call("/api/keys/heartbeat", ("key=%s&hwid=%s"):format(KEY, HttpService:UrlEncode(HWID)))
        if h and h.kick then
            return kick(h.message)
        elseif not h or h.alive == false then
            -- เน็ต/เซิร์ฟเวอร์สะดุดชั่วคราว: ไม่เตะทันที ให้โอกาส 6 รอบ (~1 นาที) กันผู้เล่นโดนเตะโดยไม่ได้ตั้งใจ
            fails += 1
            if fails >= 6 then return kick("เชื่อมต่อเซิร์ฟเวอร์คีย์ไม่ได้ต่อเนื่อง") end
        else
            fails = 0
        end
    end
end)

-- ... สคริปต์หลักของคุณต่อจากตรงนี้ ...
