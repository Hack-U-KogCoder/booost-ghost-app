// utils.h
#ifndef UTILS_H
#define UTILS_H

void GetMainScreenSize(int *width, int *height);

char* ClipboardGetText(void);
void ClipboardSetText(const char* text);
void FreeMemory(void* ptr);

#endif // UTILS_H