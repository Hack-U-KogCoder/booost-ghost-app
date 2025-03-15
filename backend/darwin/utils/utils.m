// utils.m
#import <Cocoa/Cocoa.h>
#import "utils.h"
#import "logger.h"
#import <Foundation/Foundation.h>

char* ClipboardGetText(void) {
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    NSString *string = [pasteboard stringForType:NSPasteboardTypeString];
    
    if (string == nil) {
        char* empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }
    
    // UTF-8としてエンコード
    const char* utf8String = [string UTF8String];
    size_t len = strlen(utf8String);
    
    // 新しいメモリにコピー
    char* result = (char*)malloc(len + 1);
    strcpy(result, utf8String);
    
    return result;
}

void ClipboardSetText(const char* text) {
    if (text == NULL) {
        return;
    }
    
    NSString *string = [NSString stringWithUTF8String:text];
    if (string == nil) {
        return;
    }
    
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    [pasteboard clearContents];
    [pasteboard setString:string forType:NSPasteboardTypeString];
}

void FreeMemory(void* ptr) {
    if (ptr != NULL) {
        free(ptr);
    }
}

void GetMainScreenSize(int *width, int *height) {
    NSScreen *mainScreen = [NSScreen mainScreen];
    NSRect frame = [mainScreen frame];
    *width = (int)frame.size.width;
    *height = (int)frame.size.height;
}
