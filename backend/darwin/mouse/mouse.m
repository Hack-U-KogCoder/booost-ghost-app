// mouse.m
#import <Cocoa/Cocoa.h>
#import "mouse.h"
#import "logger.h"
#import "window.h"

void EnableMouseEvents() {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSWindow* window = GetMainWindow();
        if (window != nil) {
            [window setIgnoresMouseEvents:NO];
            writeToLogFile("Mouse events enabled");
        }
    });
}

void DisableMouseEvents() {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSWindow* window = GetMainWindow();
        if (window != nil) {
            [window setIgnoresMouseEvents:YES];
            writeToLogFile("Mouse events disabled");
        }
    });
}

void ToggleMouseEvents() {
    NSWindow* window = GetMainWindow();
    if (window != nil) {
        BOOL currentState = [window ignoresMouseEvents];
        [window setIgnoresMouseEvents:!currentState];
        writeToLogFile(currentState ? "Mouse events enabled" : "Mouse events disabled");
    }
}

// マウスのX座標を取得
double GetMousePosX() {
    NSPoint mouseLoc = [NSEvent mouseLocation];
    return (double)mouseLoc.x;
}

// マウスのY座標を取得
double GetMousePosY() {
    NSPoint mouseLoc = [NSEvent mouseLocation];
    NSScreen *mainScreen = [NSScreen mainScreen];
    return (double)(mainScreen.frame.size.height - mouseLoc.y);
}