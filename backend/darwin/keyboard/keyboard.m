// keyboard.m
#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>
#import <pthread.h> // pthread関数の宣言を追加
#include <string.h>
#include <ctype.h>
#import "keyboard.h"
#import "logger.h"
#import "mouse.h"
// 最後に検出されたショートカットキーIDを保持
static int lastShortcutKeyID = 0;
// Shiftキーの二重押し検出用
static NSTimeInterval lastShiftKeyTime = 0;
static bool shiftDoublePressed = false;
static bool lastShiftState = false;
static const NSTimeInterval DOUBLE_PRESS_THRESHOLD = 0.5; // 0.5秒以内の2回押し
// ホットキーハンドラー
OSStatus HotKeyHandler(EventHandlerCallRef nextHandler, EventRef theEvent, void *userData) {
    writeToLogFile("HotKey handler called!");
    
    EventHotKeyID hotKeyID;
    OSStatus status = GetEventParameter(theEvent, kEventParamDirectObject, typeEventHotKeyID, NULL, 
                                      sizeof(EventHotKeyID), NULL, &hotKeyID);
    
    if (status != noErr) {
        writeToLogFile("Failed to get hot key ID");
        return status;
    }
    
    char buffer[100];
    snprintf(buffer, sizeof(buffer), "Hot key pressed with ID: %d", hotKeyID.id);
    writeToLogFile(buffer);
    
    // ショートカットIDを保存
    lastShortcutKeyID = hotKeyID.id;
    
    // イベント別のログ
    switch (hotKeyID.id) {
        case kHotKeyID_SC1:
            writeToLogFile("Option+1 pressed - SC1 Event");
            break;
        case kHotKeyID_SC2:
            writeToLogFile("Option+2 pressed - SC2 Event");
            break;
        case kHotKeyID_SC3:
            writeToLogFile("Option+3 pressed - SC3 Event");
            break;
        case kHotKeyID_SC4:
            writeToLogFile("Option+4 pressed - SC4 Event");
            break;
        default:
            snprintf(buffer, sizeof(buffer), "Unknown hot key ID: %d", hotKeyID.id);
            writeToLogFile(buffer);
            break;
    }
    
    return noErr;
}
// 最新のショートカットキーIDを取得
int GetLastShortcutKeyID() {
    int id = lastShortcutKeyID;
    lastShortcutKeyID = 0; // 読み取り後はリセット
    return id;
}
// Shiftキーの二重押しが検出されたかどうか
bool GetShiftDoublePressed() {
    return shiftDoublePressed;
}
// Shiftキーの二重押しフラグをリセット
void ResetShiftDoublePressed() {
    shiftDoublePressed = false;
}
void RegisterGlobalHotKey() {
    writeToLogFile("Registering global hotkeys...");
    EventHotKeyRef hotKeyRef;
    EventHotKeyID hotKeyID;
    EventTypeSpec eventType;
    OSStatus status;
    eventType.eventClass = kEventClassKeyboard;
    eventType.eventKind = kEventHotKeyPressed;
    // イベントハンドラーの登録
    status = InstallEventHandler(GetApplicationEventTarget(),
                               NewEventHandlerUPP(HotKeyHandler),
                               1, &eventType, NULL, NULL);
    if (status != noErr) {
        writeToLogFile("Failed to install event handler");
        return;
    }
    // Option+1 (ショートカット1)
    hotKeyID.signature = 'GHST';
    hotKeyID.id = kHotKeyID_SC1;
    status = RegisterEventHotKey(kVK_ANSI_1, optionKey, hotKeyID,
                              GetApplicationEventTarget(), 0, &hotKeyRef);
    
    if (status != noErr) {
        writeToLogFile("Failed to register Option+1 hotkey");
    } else {
        writeToLogFile("Option+1 hotkey registered for SC1");
    }
    // Option+2 (ショートカット2)
    hotKeyID.id = kHotKeyID_SC2;
    status = RegisterEventHotKey(kVK_ANSI_2, optionKey, hotKeyID,
                              GetApplicationEventTarget(), 0, &hotKeyRef);
    
    if (status != noErr) {
        writeToLogFile("Failed to register Option+2 hotkey");
    } else {
        writeToLogFile("Option+2 hotkey registered for SC2");
    }
    // Option+3 (ショートカット3)
    hotKeyID.id = kHotKeyID_SC3;
    status = RegisterEventHotKey(kVK_ANSI_3, optionKey, hotKeyID,
                              GetApplicationEventTarget(), 0, &hotKeyRef);
    
    if (status != noErr) {
        writeToLogFile("Failed to register Option+3 hotkey");
    } else {
        writeToLogFile("Option+3 hotkey registered for SC3");
    }
    // Option+4 (予備)
    hotKeyID.id = kHotKeyID_SC4;
    status = RegisterEventHotKey(kVK_ANSI_4, optionKey, hotKeyID,
                              GetApplicationEventTarget(), 0, &hotKeyRef);
    
    if (status != noErr) {
        writeToLogFile("Failed to register Option+4 hotkey");
    } else {
        writeToLogFile("Option+4 hotkey registered for SC4");
    }
    writeToLogFile("Global hotkeys registration completed");
}
// 文字列キー名からmacOSのキーコードに変換する関数
static int getKeyCodeFromName(const char* keyName) {
    // 修飾キー
    if (strcasecmp(keyName, "cmd") == 0 || strcasecmp(keyName, "command") == 0) return kVK_Command;
    if (strcasecmp(keyName, "lcommand") == 0 || strcasecmp(keyName, "lcmd") == 0) return kVK_Command;
    if (strcasecmp(keyName, "rcommand") == 0 || strcasecmp(keyName, "rcmd") == 0) return kVK_RightCommand;
    if (strcasecmp(keyName, "shift") == 0) return kVK_Shift;
    if (strcasecmp(keyName, "lshift") == 0) return kVK_Shift;
    if (strcasecmp(keyName, "rshift") == 0) return kVK_RightShift;
    if (strcasecmp(keyName, "alt") == 0 || strcasecmp(keyName, "option") == 0) return kVK_Option;
    if (strcasecmp(keyName, "lalt") == 0 || strcasecmp(keyName, "loption") == 0) return kVK_Option;
    if (strcasecmp(keyName, "ralt") == 0 || strcasecmp(keyName, "roption") == 0) return kVK_RightOption;
    if (strcasecmp(keyName, "ctrl") == 0 || strcasecmp(keyName, "control") == 0) return kVK_Control;
    if (strcasecmp(keyName, "lctrl") == 0 || strcasecmp(keyName, "lcontrol") == 0) return kVK_Control;
    if (strcasecmp(keyName, "rctrl") == 0 || strcasecmp(keyName, "rcontrol") == 0) return kVK_RightControl;
    
    // 特殊キー
    if (strcasecmp(keyName, "space") == 0) return kVK_Space;
    if (strcasecmp(keyName, "return") == 0 || strcasecmp(keyName, "enter") == 0) return kVK_Return;
    if (strcasecmp(keyName, "tab") == 0) return kVK_Tab;
    if (strcasecmp(keyName, "escape") == 0 || strcasecmp(keyName, "esc") == 0) return kVK_Escape;
    if (strcasecmp(keyName, "delete") == 0 || strcasecmp(keyName, "del") == 0) return kVK_Delete;
    if (strcasecmp(keyName, "backspace") == 0) return kVK_Delete;
    if (strcasecmp(keyName, "left") == 0) return kVK_LeftArrow;
    if (strcasecmp(keyName, "right") == 0) return kVK_RightArrow;
    if (strcasecmp(keyName, "up") == 0) return kVK_UpArrow;
    if (strcasecmp(keyName, "down") == 0) return kVK_DownArrow;
    if (strcasecmp(keyName, "home") == 0) return kVK_Home;
    if (strcasecmp(keyName, "end") == 0) return kVK_End;
    if (strcasecmp(keyName, "pageup") == 0) return kVK_PageUp;
    if (strcasecmp(keyName, "pagedown") == 0) return kVK_PageDown;
    if (strcasecmp(keyName, "help") == 0) return kVK_Help;
    if (strcasecmp(keyName, "forwarddelete") == 0) return kVK_ForwardDelete;
    
    // ファンクションキー
    if (strcasecmp(keyName, "f1") == 0) return kVK_F1;
    if (strcasecmp(keyName, "f2") == 0) return kVK_F2;
    if (strcasecmp(keyName, "f3") == 0) return kVK_F3;
    if (strcasecmp(keyName, "f4") == 0) return kVK_F4;
    if (strcasecmp(keyName, "f5") == 0) return kVK_F5;
    if (strcasecmp(keyName, "f6") == 0) return kVK_F6;
    if (strcasecmp(keyName, "f7") == 0) return kVK_F7;
    if (strcasecmp(keyName, "f8") == 0) return kVK_F8;
    if (strcasecmp(keyName, "f9") == 0) return kVK_F9;
    if (strcasecmp(keyName, "f10") == 0) return kVK_F10;
    if (strcasecmp(keyName, "f11") == 0) return kVK_F11;
    if (strcasecmp(keyName, "f12") == 0) return kVK_F12;
    if (strcasecmp(keyName, "f13") == 0) return kVK_F13;
    if (strcasecmp(keyName, "f14") == 0) return kVK_F14;
    if (strcasecmp(keyName, "f15") == 0) return kVK_F15;
    if (strcasecmp(keyName, "f16") == 0) return kVK_F16;
    if (strcasecmp(keyName, "f17") == 0) return kVK_F17;
    if (strcasecmp(keyName, "f18") == 0) return kVK_F18;
    if (strcasecmp(keyName, "f19") == 0) return kVK_F19;
    if (strcasecmp(keyName, "f20") == 0) return kVK_F20;
// 英字キー (a-z)
if (strlen(keyName) == 1 && ((keyName[0] >= 'a' && keyName[0] <= 'z') || (keyName[0] >= 'A' && keyName[0] <= 'Z'))) {
    char lowerKey = tolower(keyName[0]);
    switch (lowerKey) {
        case 'a': return kVK_ANSI_A;  // 0
        case 's': return kVK_ANSI_S;  // 1
        case 'd': return kVK_ANSI_D;  // 2
        case 'f': return kVK_ANSI_F;  // 3
        case 'h': return kVK_ANSI_H;  // 4
        case 'g': return kVK_ANSI_G;  // 5
        case 'z': return kVK_ANSI_Z;  // 6
        case 'x': return kVK_ANSI_X;  // 7
        case 'c': return kVK_ANSI_C;  // 8
        case 'v': return kVK_ANSI_V;  // 9
        case 'b': return kVK_ANSI_B;  // 11
        case 'q': return kVK_ANSI_Q;  // 12
        case 'w': return kVK_ANSI_W;  // 13
        case 'e': return kVK_ANSI_E;  // 14
        case 'r': return kVK_ANSI_R;  // 15
        case 'y': return kVK_ANSI_Y;  // 16
        case 't': return kVK_ANSI_T;  // 17
        case 'u': return kVK_ANSI_U;  // 32
        case 'i': return kVK_ANSI_I;  // 34
        case 'p': return kVK_ANSI_P;  // 35
        case 'l': return kVK_ANSI_L;  // 37
        case 'j': return kVK_ANSI_J;  // 38
        case 'k': return kVK_ANSI_K;  // 40
        case 'n': return kVK_ANSI_N;  // 45
        case 'm': return kVK_ANSI_M;  // 46
        case 'o': return kVK_ANSI_O;  // 31
        default: 
            return -1;
    }
}
    
    // 数字キー (0-9)
    if (strlen(keyName) == 1 && keyName[0] >= '0' && keyName[0] <= '9') {
        if (keyName[0] == '0') return kVK_ANSI_0;
        return kVK_ANSI_1 + (keyName[0] - '1');
    }
    
    // 記号キー
    if (strcmp(keyName, "minus") == 0 || strcmp(keyName, "-") == 0) return kVK_ANSI_Minus;
    if (strcmp(keyName, "equal") == 0 || strcmp(keyName, "=") == 0) return kVK_ANSI_Equal;
    if (strcmp(keyName, "leftbracket") == 0 || strcmp(keyName, "[") == 0) return kVK_ANSI_LeftBracket;
    if (strcmp(keyName, "rightbracket") == 0 || strcmp(keyName, "]") == 0) return kVK_ANSI_RightBracket;
    if (strcmp(keyName, "semicolon") == 0 || strcmp(keyName, ";") == 0) return kVK_ANSI_Semicolon;
    if (strcmp(keyName, "quote") == 0 || strcmp(keyName, "'") == 0) return kVK_ANSI_Quote;
    if (strcmp(keyName, "backslash") == 0 || strcmp(keyName, "\\") == 0) return kVK_ANSI_Backslash;
    if (strcmp(keyName, "comma") == 0 || strcmp(keyName, ",") == 0) return kVK_ANSI_Comma;
    if (strcmp(keyName, "period") == 0 || strcmp(keyName, ".") == 0) return kVK_ANSI_Period;
    if (strcmp(keyName, "slash") == 0 || strcmp(keyName, "/") == 0) return kVK_ANSI_Slash;
    if (strcmp(keyName, "grave") == 0 || strcmp(keyName, "`") == 0) return kVK_ANSI_Grave;
    
    return -1;
}
// キーコードから文字列キー名に変換する関数
static const char* getKeyNameFromCode(int keyCode) {
    switch (keyCode) {
        // 修飾キー
        case kVK_Command: return "lcommand";
        case kVK_RightCommand: return "rcommand";
        case kVK_Shift: return "lshift";
        case kVK_RightShift: return "rshift";
        case kVK_Option: return "loption";
        case kVK_RightOption: return "roption";
        case kVK_Control: return "lcontrol";
        case kVK_RightControl: return "rcontrol";
        
        // 特殊キー
        case kVK_Space: return "space";
        case kVK_Return: return "return";
        case kVK_Tab: return "tab";
        case kVK_Escape: return "escape";
        case kVK_Delete: return "delete";
        case kVK_ForwardDelete: return "forwarddelete";
        case kVK_LeftArrow: return "left";
        case kVK_RightArrow: return "right";
        case kVK_UpArrow: return "up";
        case kVK_DownArrow: return "down";
        case kVK_Home: return "home";
        case kVK_End: return "end";
        case kVK_PageUp: return "pageup";
        case kVK_PageDown: return "pagedown";
        case kVK_Help: return "help";
        
        // ファンクションキー
        case kVK_F1: return "f1";
        case kVK_F2: return "f2";
        case kVK_F3: return "f3";
        case kVK_F4: return "f4";
        case kVK_F5: return "f5";
        case kVK_F6: return "f6";
        case kVK_F7: return "f7";
        case kVK_F8: return "f8";
        case kVK_F9: return "f9";
        case kVK_F10: return "f10";
        case kVK_F11: return "f11";
        case kVK_F12: return "f12";
        case kVK_F13: return "f13";
        case kVK_F14: return "f14";
        case kVK_F15: return "f15";
        case kVK_F16: return "f16";
        case kVK_F17: return "f17";
        case kVK_F18: return "f18";
        case kVK_F19: return "f19";
        case kVK_F20: return "f20";
        
        // 英字キー (a-z)
        case kVK_ANSI_A: return "a";
        case kVK_ANSI_B: return "b";
        case kVK_ANSI_C: return "c";
        case kVK_ANSI_D: return "d";
        case kVK_ANSI_E: return "e";
        case kVK_ANSI_F: return "f";
        case kVK_ANSI_G: return "g";
        case kVK_ANSI_H: return "h";
        case kVK_ANSI_I: return "i";
        case kVK_ANSI_J: return "j";
        case kVK_ANSI_K: return "k";
        case kVK_ANSI_L: return "l";
        case kVK_ANSI_M: return "m";
        case kVK_ANSI_N: return "n";
        case kVK_ANSI_O: return "o";
        case kVK_ANSI_P: return "p";
        case kVK_ANSI_Q: return "q";
        case kVK_ANSI_R: return "r";
        case kVK_ANSI_S: return "s";
        case kVK_ANSI_T: return "t";
        case kVK_ANSI_U: return "u";
        case kVK_ANSI_V: return "v";
        case kVK_ANSI_W: return "w";
        case kVK_ANSI_X: return "x";
        case kVK_ANSI_Y: return "y";
        case kVK_ANSI_Z: return "z";
        
        // 数字キー (0-9)
        case kVK_ANSI_0: return "0";
        case kVK_ANSI_1: return "1";
        case kVK_ANSI_2: return "2";
        case kVK_ANSI_3: return "3";
        case kVK_ANSI_4: return "4";
        case kVK_ANSI_5: return "5";
        case kVK_ANSI_6: return "6";
        case kVK_ANSI_7: return "7";
        case kVK_ANSI_8: return "8";
        case kVK_ANSI_9: return "9";
        
        // 記号キー
        case kVK_ANSI_Minus: return "minus";
        case kVK_ANSI_Equal: return "equal";
        case kVK_ANSI_LeftBracket: return "leftbracket";
        case kVK_ANSI_RightBracket: return "rightbracket";
        case kVK_ANSI_Semicolon: return "semicolon";
        case kVK_ANSI_Quote: return "quote";
        case kVK_ANSI_Backslash: return "backslash";
        case kVK_ANSI_Comma: return "comma";
        case kVK_ANSI_Period: return "period";
        case kVK_ANSI_Slash: return "slash";
        case kVK_ANSI_Grave: return "grave";
        
        // 不明なキー
        default: return NULL;
    }
}
// 全キーコードのリスト
static const int ALL_KEY_CODES[] = {
    // 修飾キー
    kVK_Command, kVK_RightCommand, kVK_Shift, kVK_RightShift,
    kVK_Option, kVK_RightOption, kVK_Control, kVK_RightControl,
    
    // 特殊キー
    kVK_Space, kVK_Return, kVK_Tab, kVK_Escape, kVK_Delete, kVK_ForwardDelete,
    kVK_LeftArrow, kVK_RightArrow, kVK_UpArrow, kVK_DownArrow,
    kVK_Home, kVK_End, kVK_PageUp, kVK_PageDown, kVK_Help,
    
    // ファンクションキー
    kVK_F1, kVK_F2, kVK_F3, kVK_F4, kVK_F5, kVK_F6, kVK_F7, kVK_F8, kVK_F9, kVK_F10,
    kVK_F11, kVK_F12, kVK_F13, kVK_F14, kVK_F15, kVK_F16, kVK_F17, kVK_F18, kVK_F19, kVK_F20,
    
    // 英字キー
    kVK_ANSI_A, kVK_ANSI_B, kVK_ANSI_C, kVK_ANSI_D, kVK_ANSI_E, kVK_ANSI_F, kVK_ANSI_G,
    kVK_ANSI_H, kVK_ANSI_I, kVK_ANSI_J, kVK_ANSI_K, kVK_ANSI_L, kVK_ANSI_M, kVK_ANSI_N,
    kVK_ANSI_O, kVK_ANSI_P, kVK_ANSI_Q, kVK_ANSI_R, kVK_ANSI_S, kVK_ANSI_T, kVK_ANSI_U,
    kVK_ANSI_V, kVK_ANSI_W, kVK_ANSI_X, kVK_ANSI_Y, kVK_ANSI_Z,
    
    // 数字キー
    kVK_ANSI_0, kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4,
    kVK_ANSI_5, kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9,
    
    // 記号キー
    kVK_ANSI_Minus, kVK_ANSI_Equal, kVK_ANSI_LeftBracket, kVK_ANSI_RightBracket,
    kVK_ANSI_Semicolon, kVK_ANSI_Quote, kVK_ANSI_Backslash, kVK_ANSI_Comma,
    kVK_ANSI_Period, kVK_ANSI_Slash, kVK_ANSI_Grave
};
#define ALL_KEYS_COUNT (sizeof(ALL_KEY_CODES) / sizeof(ALL_KEY_CODES[0]))
// 複数のキーを同時に押すシミュレーション関数
void SimulateKeyPresses(const char* keyString) {
    char logBuffer[256];
    snprintf(logBuffer, sizeof(logBuffer), "Simulating key presses: %s", keyString);
    writeToLogFile(logBuffer);
    
    // keyStringのコピーを作成（strtokは文字列を変更するため）
    char* keyCopy = strdup(keyString);
    if (!keyCopy) {
        writeToLogFile("Memory allocation failed");
        return;
    }
    
    // カンマ区切りのキーリストを解析
    const char delimiters[] = ",";
    char* token = strtok(keyCopy, delimiters);
    
    // 押すキーのコードを格納
    int keyCodes[32]; // 最大32キーまで対応
    int keyCount = 0;
    
    // すべてのキーのキーコードを取得
    while (token != NULL && keyCount < 32) {
        // 先頭の空白を除去
        while (isspace((unsigned char)*token)) token++;
        
        // 末尾の空白を除去
        char* end = token + strlen(token) - 1;
        while (end > token && isspace((unsigned char)*end)) end--;
        *(end + 1) = '\0';
        
        int keyCode = getKeyCodeFromName(token);
        if (keyCode != -1) {
            keyCodes[keyCount++] = keyCode;
            snprintf(logBuffer, sizeof(logBuffer), "Found key code! %d for %s", keyCode, token);
            writeToLogFile(logBuffer);
        } else {
            snprintf(logBuffer, sizeof(logBuffer), "Unknown key: %s", token);
            writeToLogFile(logBuffer);
        }
        
        token = strtok(NULL, delimiters);
    }
    
    free(keyCopy);
    
    if (keyCount == 0) {
        writeToLogFile("No valid keys to simulate");
        return;
    }
    
    // キーボードイベント用のソースを作成
    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!source) {
        writeToLogFile("Failed to create event source");
        return;
    }
    
    // すべてのキーのキーダウンイベントを作成
    for (int i = 0; i < keyCount; i++) {
        CGEventRef event = CGEventCreateKeyboardEvent(source, keyCodes[i], true);
        CGEventPost(kCGHIDEventTap, event);
        CFRelease(event);
        
        // キーダウンイベント間の小さな遅延
        usleep(10000); // 10ms
    }
    
    // キーダウンとキーアップのシーケンス間の小さな遅延
    usleep(100000); // 100ms
    
    // 逆順ですべてのキーのキーアップイベントを作成
    for (int i = keyCount - 1; i >= 0; i--) {
        CGEventRef event = CGEventCreateKeyboardEvent(source, keyCodes[i], false);
        CGEventPost(kCGHIDEventTap, event);
        CFRelease(event);
        
        // キーアップイベント間の小さな遅延
        usleep(10000); // 10ms
    }
    
    CFRelease(source);
    writeToLogFile("Key simulation completed");
}
// 現在押されているキーを文字列として取得する関数
char* GetPressedKeysString() {
    // バッファを初期化（最大1024バイト）
    char buffer[1024] = {0};
    int bufferLen = 0;
    int keysFound = 0;
    
    // すべてのキーをチェック
    for (int i = 0; i < ALL_KEYS_COUNT; i++) {
        int keyCode = ALL_KEY_CODES[i];
        // キーが押されているかチェック
        bool isPressed = CGEventSourceKeyState(kCGEventSourceStateHIDSystemState, keyCode);
        
        if (isPressed) {
            const char* keyName = getKeyNameFromCode(keyCode);
            if (keyName) {
                // キーが見つかった場合、カンマを追加（最初のキー以外）
                if (keysFound > 0) {
                    buffer[bufferLen++] = ',';
                }
                
                // キー名をバッファに追加
                int keyNameLen = strlen(keyName);
                if (bufferLen + keyNameLen < sizeof(buffer) - 1) {
                    strcpy(buffer + bufferLen, keyName);
                    bufferLen += keyNameLen;
                    keysFound++;
                }
            }
        }
    }
    
    char logBuffer[128];
    snprintf(logBuffer, sizeof(logBuffer), "Found %d pressed keys: %s", keysFound, buffer);
    writeToLogFile(logBuffer);
    
    // Shiftキーの二重押し検出ロジック
    bool isShiftPressed = (strstr(buffer, "lshift") != NULL || 
                         strstr(buffer, "rshift") != NULL);
    
    if (isShiftPressed && !lastShiftState) {
        // Shiftキーが押された時
        NSTimeInterval currentTime = [[NSDate date] timeIntervalSince1970];
        NSTimeInterval timeDiff = currentTime - lastShiftKeyTime;
        
        if (timeDiff < DOUBLE_PRESS_THRESHOLD && timeDiff > 0.05) {
            // 前回のShiftキー押下から閾値時間以内、かつちゃんと離した後に押した場合
            shiftDoublePressed = true;
            writeToLogFile("Double Shift detected!");
        }
        
        lastShiftKeyTime = currentTime;
    }
    
    lastShiftState = isShiftPressed;
    
    // 結果の文字列を動的に割り当て
    return strdup(buffer);
}
// Goのコールバック関数を宣言
extern void KeyStateCallback(char* keysString);
// バックグラウンド監視用の変数
static volatile bool isMonitoring = false;
static pthread_t monitoringThread;
static char* callbackFunctionName = NULL;
// バックグラウンドでキーを監視する関数
static void* keyMonitoringThread(void* arg) {
    char logBuffer[128];
    snprintf(logBuffer, sizeof(logBuffer), "Key monitoring thread started with callback: %s", callbackFunctionName);
    writeToLogFile(logBuffer);
    
    char* previousKeysString = strdup("");
    
    while (isMonitoring) {
        // 現在押されているキーを取得
        char* currentKeysString = GetPressedKeysString();
        
        // 前回の状態と比較して変更があれば通知
        if (strcmp(currentKeysString, previousKeysString) != 0) {
            snprintf(logBuffer, sizeof(logBuffer), "Keys changed: %s", currentKeysString);
            writeToLogFile(logBuffer);
            
            // Goのコールバック関数を呼び出す
            KeyStateCallback(currentKeysString);
            
            // 前回の状態を更新
            free(previousKeysString);
            previousKeysString = strdup(currentKeysString);
        }
        
        free(currentKeysString);
        
        // 監視の頻度（ミリ秒）
        usleep(50000); // 50ms
    }
    
    free(previousKeysString);
    writeToLogFile("Key monitoring thread stopped");
    
    return NULL;
}
// バックグラウンドでキー監視を開始する関数
void StartKeyMonitoring(const char* callbackName) {
    if (isMonitoring) {
        writeToLogFile("Key monitoring is already running");
        return;
    }
    
    // コールバック関数名を保存
    if (callbackFunctionName) {
        free(callbackFunctionName);
    }
    callbackFunctionName = strdup(callbackName);
    
    // 監視フラグをセット
    isMonitoring = true;
    
    // 監視スレッドを開始
    if (pthread_create(&monitoringThread, NULL, keyMonitoringThread, NULL) != 0) {
        writeToLogFile("Failed to create monitoring thread");
        isMonitoring = false;
        free(callbackFunctionName);
        callbackFunctionName = NULL;
        return;
    }
    
    writeToLogFile("Key monitoring started");
}
// バックグラウンドでのキー監視を停止する関数
void StopKeyMonitoring() {
    if (!isMonitoring) {
        writeToLogFile("Key monitoring is not running");
        return;
    }
    
    // 監視フラグをクリア
    isMonitoring = false;
    
    // スレッドの終了を待機
    pthread_join(monitoringThread, NULL);
    
    // リソースを解放
    if (callbackFunctionName) {
        free(callbackFunctionName);
        callbackFunctionName = NULL;
    }
    
    // Shiftキー状態をリセット
    lastShiftKeyTime = 0;
    shiftDoublePressed = false;
    lastShiftState = false;
    
    writeToLogFile("Key monitoring stopped");
}