// window.m
#import <Cocoa/Cocoa.h>
#import "window.h"
#import "logger.h"
#import "keyboard.h"

static NSWindow* savedWindow = nil;
static NSTimer* monitorTimer = nil;
static pid_t lastActivePID = 0;
static NSString* lastGhostId = @"default";


extern void ShortcutCallback(const char* eventType);

NSWindow* GetMainWindow() {
    return savedWindow;
}

// 最後に選択されたゴーストIDを取得
const char* GetLastGhostId() {
    return [lastGhostId UTF8String];
}

void MonitorActiveWindow() {
    NSRunningApplication *activeApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
    if (activeApp != nil && activeApp.processIdentifier != [[NSProcessInfo processInfo] processIdentifier]) {
        lastActivePID = activeApp.processIdentifier;
        NSString *appName = [activeApp localizedName];
        writeToLogFile([[NSString stringWithFormat:@"Currently active app: %@ (PID: %d)", 
                        appName, lastActivePID] UTF8String]);
    }
}

void StartMonitoring() {
    writeToLogFile("Starting monitoring services");
    if (monitorTimer == nil) {
        monitorTimer = [NSTimer scheduledTimerWithTimeInterval:0.1
                                                    repeats:YES
                                                      block:^(NSTimer *timer) {
            MonitorActiveWindow();
        }];
    }
}

void StopMonitoring() {
    if (monitorTimer != nil) {
        [monitorTimer invalidate];
        monitorTimer = nil;
        writeToLogFile("Stopped monitoring services");
    }
}

void ReturnFocusToPreviousWindow() {
    writeToLogFile("Attempting to return focus...");
    if (lastActivePID != 0) {
        NSRunningApplication *lastApp = [NSRunningApplication
                                       runningApplicationWithProcessIdentifier:lastActivePID];
        if (lastApp != nil) {
            writeToLogFile([[NSString stringWithFormat:@"Returning focus to: %@",
                            [lastApp localizedName]] UTF8String]);
            // macOS 14での非推奨警告を抑制するためのプラグマディレクティブ
            #pragma clang diagnostic push
            #pragma clang diagnostic ignored "-Wdeprecated-declarations"
            [lastApp activateWithOptions:NSApplicationActivateIgnoringOtherApps];
            #pragma clang diagnostic pop
        } else {
            writeToLogFile("Previous application no longer exists");
        }
    } else {
        writeToLogFile("No previous window to return to");
    }
}

void SetupMainWindow() {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            NSWindow *window = [NSApp mainWindow];
            if (window != nil) {
                savedWindow = window;

                [window setStyleMask:NSWindowStyleMaskBorderless];
                [window setLevel:NSFloatingWindowLevel];
                [window setCollectionBehavior:(NSWindowCollectionBehaviorCanJoinAllSpaces |
                                             NSWindowCollectionBehaviorParticipatesInCycle |
                                             NSWindowCollectionBehaviorManaged)];

                [window setOpaque:NO];
                [window setAlphaValue:1.0];
                [window setBackgroundColor:[NSColor clearColor]];

                [window setHasShadow:NO];
                [window setTitlebarAppearsTransparent:YES];
                [window setMovableByWindowBackground:YES];
                [window setIgnoresMouseEvents:YES];

                RegisterGlobalHotKey();
                StartMonitoring();
                writeToLogFile("Window setup completed");

                if ([window level] == NSFloatingWindowLevel) {
                    writeToLogFile("Floating window settings successfully applied");
                } else {
                    writeToLogFile("Failed to apply window level settings");
                }
            } else {
                writeToLogFile("Main window not found in SetupMainWindow");
            }
        } @catch (NSException *exception) {
            NSString *errorMsg = [NSString stringWithFormat:@"Error in SetupMainWindow: %@", 
                                exception.reason];
            writeToLogFile([errorMsg UTF8String]);
        }
    });
}