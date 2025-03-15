// window.h
#ifndef WINDOW_H
#define WINDOW_H

#import <Cocoa/Cocoa.h>

void SetupMainWindow(void);
void ReturnFocusToPreviousWindow(void);
NSWindow* GetMainWindow(void);
void StartMonitoring(void);
void StopMonitoring(void);
void MonitorActiveWindow(void);
const char* GetLastGhostId(void);

#endif // WINDOW_H