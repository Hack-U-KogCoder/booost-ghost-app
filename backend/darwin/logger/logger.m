#import <Cocoa/Cocoa.h>
#import "logger.h"

void writeToLogFile(const char* message) {
//    NSString *logMessage = [NSString stringWithUTF8String:message];
//    NSString *documentsPath = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES)[0];
//    NSString *logPath = [documentsPath stringByAppendingPathComponent:@"app.log"];

//    NSFileHandle *fileHandle = [NSFileHandle fileHandleForWritingAtPath:logPath];
//    if (fileHandle == nil) {
//        [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil];
//        fileHandle = [NSFileHandle fileHandleForWritingAtPath:logPath];
//    }

//    [fileHandle seekToEndOfFile];
//    NSString *timestampedMessage = [NSString stringWithFormat:@"%@: %@\n",
//                                   [NSDate date], logMessage];
//    [fileHandle writeData:[timestampedMessage dataUsingEncoding:NSUTF8StringEncoding]];
//    [fileHandle closeFile];
}