local toggleServerKeybind = "Ctrl+d"
local executablePath = "@EXECUTABLE_PATH"

local pipe = mp.get_property("input-ipc-server")
local utils = require "mp.utils"

local server = nil
local timer = nil
local paused = false
local currentFile = ""

local function stopServer()
    if server == nil then return end
    if timer then
        timer:kill()
        timer = nil
    end
    server:write("kill:\n")
    server:flush()
    server:close()
    server = nil
    mp.osd_message("Mining server stopped")
end

local function updateTime()
    if server == nil then return end
    local pos = mp.get_property("time-pos")
    if pos then
        server:write("time:" .. pos * 1000 .. " \n")
        server:flush()
    end
end
local ipcError = false -- only use this for small things
local inited = false
local function init()
    if inited then return end
    inited = true
    mp.register_event("seek", updateTime)
    mp.register_event("property-change", function(e)
        if e.name == "sub-text" then
            updateTime()
        elseif e.name == "pause" then
            paused = e.data
            updateTime()
        end
    end)
    mp.enable_messages("error")
    -- this isn't guaranteed to work, don't rely heavily on it
    mp.register_event("log-message", function(message)
        if message.prefix == "ipc" and message.level == "error" then
            ipcError = true
            mp.osd_message("ipc error occured, see console", 5)
        end
    end)
    mp.observe_property("sub-text", "string", function() end)
    mp.observe_property("pause", "bool", function() end)
    currentFile = mp.get_property("path") or ""
    mp.register_event("file-loaded", function()
        local newFile = mp.get_property("path") or ""
        if newFile == currentFile then return end
        currentFile = newFile
        if server == nil then return end
        server:write("current-file:" .. currentFile .. "\n")
        server:flush()
    end)
end

local function startServer()
    local exeInfo = utils.file_info(executablePath)
    if not exeInfo or not exeInfo.is_file then
        mp.osd_message("Mining server " .. executablePath .. " not found.\nPlease configure it in the mpv script.", 10)
        return
    end
    init()
    if server then return end
    if pipe ~= nil and ipcError then
        mp.set_property("input-ipc-server", "")
        mp.set_property("input-ipc-server", pipe)
    end
    if pipe == nil or pipe == "" then
        -- TODO not sure if these `\` work on Linux, probably not
        -- Should be fixable on Linux by manually setting ipc in the config
        pipe = "\\\\.\\pipe\\tmp\\mpv-socket"
        mp.set_property("input-ipc-server", pipe)
    end

    -- TODO lua sucks and popen is garbage
    -- instead, use mp.command_native_async with IPC
    server = io.popen(executablePath, "w")
    if server == nil then return end
    server:write("pipe:" .. pipe .. "\n")
    server:flush()
    if currentFile ~= "" then
        server:write("current-file:" .. currentFile .. "\n")
        server:flush()
    end

    local i = 0
    timer = mp.add_periodic_timer(0.5, function()
        if not paused or i > 1 then
            updateTime()
            i = 0
        else
            i = i + 1
        end
    end)
    mp.register_event("shutdown", stopServer)

    mp.osd_message("Mining server started")
end

mp.register_script_message("start_ipc", function()
    if pipe == nil or pipe == "" then
        pipe = "\\\\.\\pipe\\tmp\\mpv-socket"
        mp.set_property("input-ipc-server", pipe)
    end
end)

local function toggleWebsocket()
    if server == nil then
        startServer()
    else
        stopServer()
    end
end
mp.add_key_binding(toggleServerKeybind, "toggle-websocket", toggleWebsocket)
