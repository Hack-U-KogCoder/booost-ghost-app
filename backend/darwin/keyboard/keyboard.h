#ifndef KEYBOARD_H
#define KEYBOARD_H
#include <Carbon/Carbon.h>
void RegisterGlobalHotKey(void);
OSStatus HotKeyHandler(EventHandlerCallRef nextHandler, EventRef theEvent, void *userData);
enum {
    kHotKeyID_SC1 = 1,   
    kHotKeyID_SC2 = 2,   
    kHotKeyID_SC3 = 3,   
    kHotKeyID_SC4 = 4    
};
void SimulateKeyPresses(const char* keyString);
char* GetPressedKeysString(void);
void StartKeyMonitoring(const char* callbackName);
void StopKeyMonitoring(void);
int GetLastShortcutKeyID(void);
bool GetShiftDoublePressed(void);
void ResetShiftDoublePressed(void);
#endif 