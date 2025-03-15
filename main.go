package main

/*
#cgo CFLAGS: -x objective-c -I${SRCDIR}/backend/darwin/utils -I${SRCDIR}/backend/darwin/mouse -I${SRCDIR}/backend/darwin/keyboard -I${SRCDIR}/backend/darwin/window -I${SRCDIR}/backend/darwin/logger
#cgo LDFLAGS: -framework Cocoa -framework Carbon
#include "utils.h"
#include "mouse.h"
#include "keyboard.h"
#include "window.h"
#include "logger.h"

#include "backend/darwin/utils/utils.m"
#include "backend/darwin/mouse/mouse.m"
#include "backend/darwin/keyboard/keyboard.m"
#include "backend/darwin/window/window.m"
#include "backend/darwin/logger/logger.m"
*/
import "C"

import (
	"context"
	"embed"
	"log"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// グローバルなアプリインスタンスへの参照
var globalApp *App

func getScreenSize() (width, height int) {
	var w, h C.int
	C.GetMainScreenSize(&w, &h)
	return int(w), int(h)
}

func (a *App) shutdown(ctx context.Context) {
	// ショートカット監視を停止
	a.stopShortcutMonitoring()

	// キー監視を停止
	a.StopKeyMonitoring()

	// モニタリングを停止
	C.StopMonitoring()
}

func main() {
	app := NewApp()
	globalApp = app

	width, height := getScreenSize()
	err := wails.Run(&options.App{
		Title:            "FloatingWindow",
		Width:            width,
		Height:           height,
		DisableResize:    true,
		AssetServer:      &assetserver.Options{Assets: assets},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		Mac: &mac.Options{
			WebviewIsTransparent: true,
			TitleBar:             mac.TitleBarHiddenInset(),
			Appearance:           mac.NSAppearanceNameDarkAqua,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		OnDomReady: func(ctx context.Context) {
			// ウィンドウ設定を適用
			C.SetupMainWindow()

			// ショートカット監視を開始
			app.startShortcutMonitoring()

			// キー状態監視を開始
			if err := app.StartKeyMonitoring(); err != nil {
				log.Printf("Error starting key monitoring: %v", err)
			}

			// 定期的にゴースト状態を確認するタイマーを開始
			go func() {
				ticker := time.NewTicker(100 * time.Millisecond)
				defer ticker.Stop()

				var lastGhostId string

				for range ticker.C {
					ghostId := C.GoString(C.GetLastGhostId())
					if ghostId != lastGhostId {
						lastGhostId = ghostId
						log.Printf("Ghost changed: %s", ghostId)
						runtime.EventsEmit(ctx, "switch-ghost", ghostId)
					}
				}
			}()
		},
		Bind: []interface{}{app},
	})

	if err != nil {
		log.Fatal("Error:", err.Error())
	}
}
