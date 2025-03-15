package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework Carbon
#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>
void SetWindowLevel();
void EnableMouseEvents();
void DisableMouseEvents();
void ReturnFocusToPreviousWindow();
void SimulateKeyPresses(const char* keyString);
char* GetPressedKeysString(void);
void StartKeyMonitoring(const char* callbackName);
void StopKeyMonitoring(void);
double GetMousePosX(void);
double GetMousePosY(void);
int GetLastShortcutKeyID(void);
bool GetShiftDoublePressed(void);
void ResetShiftDoublePressed(void);
void ClipboardSetText(const char* text);
char* ClipboardGetText(void);
void FreeMemory(void* ptr);
*/
import "C"
import (
	"context"
	"encoding/base64"
	"encoding/json" // JSONパーサー用
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

type MousePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// PluginInfo はプラグインの基本情報を格納する構造体
type PluginInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Shortcut    string `json:"shortcut"`
	Icon        string `json:"icon"`
}

// ディレクトリエントリ情報
type DirectoryEntry struct {
	Name        string `json:"name"`
	IsDirectory bool   `json:"isDirectory"`
}

// プラグインマニフェスト
type GhostManifest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Shortcut    string `json:"shortcut"`
	Icon        string `json:"icon"`
}

// ログレベル定義
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

// プラグインディレクトリの検証結果
type PluginValidationResult struct {
	PluginPath    string          `json:"pluginPath"`
	IsValid       bool            `json:"isValid"`
	HasManifest   bool            `json:"hasManifest"`
	HasContent    bool            `json:"hasContent"`
	HasBackground bool            `json:"hasBackground"`
	HasIcon       bool            `json:"hasIcon"`
	Errors        []string        `json:"errors"`
	Manifest      json.RawMessage `json:"manifest,omitempty"`
}

func NewApp() *App {
	return &App{}
}

// マウス位置を取得するためのメソッド
func (a *App) GetMousePosition(x float64, y float64) MousePosition {
	return MousePosition{
		X: x,
		Y: y,
	}
}

func (a *App) EnableMouseEvents() {
	C.EnableMouseEvents()
}

func (a *App) DisableMouseEvents() {
	C.DisableMouseEvents()
}

func (a *App) ReturnFocusToPreviousWindow() {
	C.ReturnFocusToPreviousWindow()
}

// クリップボードから文字列を読み取るメソッド（ネイティブ実装）
func (a *App) ReadClipboard() (string, error) {
	// ネイティブAPIを呼び出す
	cstr := C.ClipboardGetText()

	// 関数終了時にメモリを解放
	defer C.FreeMemory(unsafe.Pointer(cstr))

	// C文字列をGo文字列に変換
	goText := C.GoString(cstr)

	return goText, nil
}

// クリップボードに文字列を書き込むメソッド（ネイティブ実装）
func (a *App) WriteClipboard(text string) error {
	// 文字列をC文字列に変換
	cText := C.CString(text)
	// 関数終了時にメモリを解放
	defer C.free(unsafe.Pointer(cText))

	// ネイティブAPIでクリップボードに書き込み
	C.ClipboardSetText(cText)

	return nil
}

// スクリーンショットを撮る関数
func (a *App) TakeScreenshot() error {
	screenshotPath := filepath.Join(os.ExpandEnv("$HOME"), "Desktop", fmt.Sprintf("screenshot_%s.png", time.Now().Format("20060102_150405")))
	cmd := exec.Command("screencapture", "-i", screenshotPath)
	return cmd.Run()
}

// メモを開く関数
func (a *App) OpenMemo() error {
	cmd := exec.Command("open", "-a", "Notes")
	return cmd.Run()
}

func (a *App) SimulateKeyPress(keyString string) error {
	trimmedKeyString := strings.TrimSpace(keyString)
	fmt.Printf("Sending key string: '%s'\n", trimmedKeyString)
	cKeyString := C.CString(trimmedKeyString)
	defer C.free(unsafe.Pointer(cKeyString))
	C.SimulateKeyPresses(cKeyString)

	return nil
}

// GetPressedKeys 現在押されているキーをカンマ区切りの文字列として取得
// 返り値: カンマ区切りのキー名文字列 (例: "lcommand,space")
func (a *App) GetPressedKeys() string {
	// C関数を呼び出して押されているキーの文字列を取得
	cKeysString := C.GetPressedKeysString()
	// 関数終了時にメモリを解放
	defer C.free(unsafe.Pointer(cKeysString))

	// C文字列をGo文字列に変換
	keysString := C.GoString(cKeysString)

	return keysString
}

// KeyStateCallback は、キーの状態が変化したときにC言語から呼び出されるコールバック関数
//
//export KeyStateCallback
func KeyStateCallback(cKeysString *C.char) {
	// C文字列をGo文字列に変換
	keysString := C.GoString(cKeysString)

	// アプリインスタンスにアクセスして、イベントを発火
	if app != nil && app.ctx != nil {
		runtime.EventsEmit(app.ctx, "key-state-changed", keysString)
	}
}

// バックグラウンドでのキー状態監視を保持するためのグローバル変数
var app *App

// StartKeyMonitoring バックグラウンドでのキー監視を開始
func (a *App) StartKeyMonitoring() error {
	// グローバル変数にアプリインスタンスを設定
	app = a

	// コールバック関数名をC文字列に変換
	cCallbackName := C.CString("KeyStateCallback")
	defer C.free(unsafe.Pointer(cCallbackName))

	// キー監視を開始
	C.StartKeyMonitoring(cCallbackName)

	return nil
}

// StopKeyMonitoring バックグラウンドでのキー監視を停止
func (a *App) StopKeyMonitoring() error {
	// キー監視を停止
	C.StopKeyMonitoring()

	return nil
}

// プラグインのリストを取得する関数
func (a *App) GetPluginDirectories() []string {
	fmt.Println("GetPluginDirectories called")

	// ユーザーのホームディレクトリを取得
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting user home directory: %v\n", err)
		return []string{}
	}

	// プラグインディレクトリの優先順位
	pluginDirs := []string{
		filepath.Join(homeDir, ".config", "ghostcursor", "plugins"),
		"/opt/ghostcursor/plugins",
		filepath.Join(homeDir, "ghostcursor", "ghosts"),
	}

	fmt.Printf("Checking plugin directories: %v\n", pluginDirs)

	existingDirs := []string{}
	for _, dir := range pluginDirs {
		_, err := os.Stat(dir)
		if err == nil {
			fmt.Printf("Directory exists: %s\n", dir)
			existingDirs = append(existingDirs, dir)
		} else if os.IsNotExist(err) {
			fmt.Printf("Directory does not exist: %s\n", dir)
		} else {
			fmt.Printf("Error checking directory %s: %v\n", dir, err)
		}
	}

	fmt.Printf("Returning existing plugin directories: %v\n", existingDirs)
	return existingDirs
}

// ディレクトリ内のエントリを一覧
func (a *App) ListPluginEntries(dir string) ([]DirectoryEntry, error) {
	fmt.Printf("ListPluginEntries called for: %s\n", dir)

	// ディレクトリの存在を確認
	dirInfo, err := os.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("Directory does not exist: %s\n", dir)
		} else {
			fmt.Printf("Error checking directory %s: %v\n", dir, err)
		}
		return nil, err
	}

	if !dirInfo.IsDir() {
		errMsg := fmt.Sprintf("%s is not a directory", dir)
		fmt.Println(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

	// ディレクトリの内容を読み取る
	files, err := os.ReadDir(dir)
	if err != nil {
		fmt.Printf("Error reading directory %s: %v\n", dir, err)
		return nil, err
	}

	entries := make([]DirectoryEntry, 0, len(files))
	for _, file := range files {
		entry := DirectoryEntry{
			Name:        file.Name(),
			IsDirectory: file.IsDir(),
		}
		entries = append(entries, entry)
	}

	fmt.Printf("Found %d entries in %s\n", len(entries), dir)
	return entries, nil
}

// プラグインのマニフェストを読み込む
func (a *App) ReadPluginManifest(path string) (GhostManifest, error) {
	fmt.Printf("ReadPluginManifest called for: %s\n", path)
	var manifest GhostManifest

	// ファイルの存在を確認
	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Printf("Manifest file does not exist: %s\n", path)
		} else {
			fmt.Printf("Error checking manifest file %s: %v\n", path, err)
		}
		return manifest, err
	}

	// マニフェストファイルを読み込み
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("Error reading manifest file %s: %v\n", path, err)
		return manifest, err
	}

	// JSONとしてパース
	err = json.Unmarshal(data, &manifest)
	if err != nil {
		fmt.Printf("Error parsing manifest file %s: %v\n", path, err)
		return manifest, err
	}

	fmt.Printf("Successfully read manifest: %s (id: %s)\n", manifest.Name, manifest.ID)
	return manifest, nil
}

// プラグインモジュールを読み込む
func (a *App) ReadPluginModule(pluginDir string, moduleName string) (string, error) {
	fmt.Printf("ReadPluginModule called for: %s/%s\n", pluginDir, moduleName)

	// 探索する拡張子とパスの優先順位
	possiblePaths := []string{
		// 新しいindex.js/tsファイル
		filepath.Join(pluginDir, "dist", "index.js"),
		filepath.Join(pluginDir, "index.js"),
		filepath.Join(pluginDir, "dist", "index.ts"),
		filepath.Join(pluginDir, "index.ts"),
		// コンパイル済みJavaScript (distディレクトリ)
		filepath.Join(pluginDir, "dist", moduleName+".js"),
		// ルートディレクトリのJavaScript
		filepath.Join(pluginDir, moduleName+".js"),
		// TypeScriptソースファイル (distディレクトリ)
		filepath.Join(pluginDir, "dist", moduleName+".ts"),
		// ルートディレクトリのTypeScript
		filepath.Join(pluginDir, moduleName+".ts"),
	}

	// 各ファイルの存在を確認して最初に見つかったものを使用
	var foundPath string
	for _, path := range possiblePaths {
		fmt.Printf("Checking for: %s\n", path)
		_, err := os.Stat(path)
		if err == nil {
			foundPath = path
			fmt.Printf("Found module at: %s\n", foundPath)
			break
		}
	}

	if foundPath == "" {
		errorMsg := fmt.Sprintf("Module file %s not found in any location", moduleName)
		fmt.Println(errorMsg)
		return "", fmt.Errorf(errorMsg)
	}

	// モジュールファイルを読み込み
	data, err := os.ReadFile(foundPath)
	if err != nil {
		fmt.Printf("Error reading module file %s: %v\n", foundPath, err)
		return "", err
	}

	fmt.Printf("Successfully read module %s from %s\n", moduleName, foundPath)
	return string(data), nil
}

// 単一のプラグインディレクトリを検証
func (a *App) validatePlugin(pluginPath string) PluginValidationResult {
	fmt.Printf("Validating plugin at: %s\n", pluginPath)

	result := PluginValidationResult{
		PluginPath: pluginPath,
		IsValid:    false,
		Errors:     []string{},
	}

	// マニフェストファイルの確認
	manifestPath := filepath.Join(pluginPath, "manifest.json")
	manifestInfo, err := os.Stat(manifestPath)
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("Manifest file not found: %v", err))
	} else if manifestInfo.IsDir() {
		result.Errors = append(result.Errors, "Manifest is a directory, not a file")
	} else {
		result.HasManifest = true

		// マニフェストファイルの内容を読み込む
		manifestData, err := os.ReadFile(manifestPath)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to read manifest: %v", err))
		} else {
			// マニフェストがJSONとして解析できるかチェック
			var manifestObj map[string]interface{}
			if err := json.Unmarshal(manifestData, &manifestObj); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Invalid manifest JSON: %v", err))
			} else {
				result.Manifest = manifestData

				// アイコンパスの確認
				if iconPath, ok := manifestObj["icon"].(string); ok {
					// アイコンパスが相対パスの場合
					if !filepath.IsAbs(iconPath) {
						iconFullPath := filepath.Join(pluginPath, iconPath)
						iconInfo, err := os.Stat(iconFullPath)
						if err != nil {
							// assetsディレクトリも確認
							iconFullPath = filepath.Join(pluginPath, "assets", filepath.Base(iconPath))
							iconInfo, err = os.Stat(iconFullPath)
							if err != nil {
								result.Errors = append(result.Errors, fmt.Sprintf("Icon file not found: %v", err))
							} else if iconInfo.IsDir() {
								result.Errors = append(result.Errors, "Icon path points to a directory")
							} else {
								result.HasIcon = true
							}
						} else if iconInfo.IsDir() {
							result.Errors = append(result.Errors, "Icon path points to a directory")
						} else {
							result.HasIcon = true
						}
					}
				}
			}
		}
	}

	// index.js/tsファイルの確認（複数の場所と拡張子をチェック）
	indexExists := false
	possibleIndexPaths := []string{
		filepath.Join(pluginPath, "dist", "index.js"),
		filepath.Join(pluginPath, "index.js"),
		filepath.Join(pluginPath, "dist", "index.ts"),
		filepath.Join(pluginPath, "index.ts"),
	}

	for _, indexPath := range possibleIndexPaths {
		indexInfo, err := os.Stat(indexPath)
		if err == nil && !indexInfo.IsDir() {
			indexExists = true
			fmt.Printf("Found index file at: %s\n", indexPath)
			break
		}
	}

	// 旧式のcontent.js/tsとbackground.js/tsファイルの確認
	if !indexExists {
		contentExists := false
		possibleContentPaths := []string{
			filepath.Join(pluginPath, "dist", "content.js"),
			filepath.Join(pluginPath, "content.js"),
			filepath.Join(pluginPath, "dist", "content.ts"),
			filepath.Join(pluginPath, "content.ts"),
		}

		for _, contentPath := range possibleContentPaths {
			contentInfo, err := os.Stat(contentPath)
			if err == nil && !contentInfo.IsDir() {
				contentExists = true
				fmt.Printf("Found content file at: %s\n", contentPath)
				break
			}
		}

		backgroundExists := false
		possibleBackgroundPaths := []string{
			filepath.Join(pluginPath, "dist", "background.js"),
			filepath.Join(pluginPath, "background.js"),
			filepath.Join(pluginPath, "dist", "background.ts"),
			filepath.Join(pluginPath, "background.ts"),
		}

		for _, backgroundPath := range possibleBackgroundPaths {
			backgroundInfo, err := os.Stat(backgroundPath)
			if err == nil && !backgroundInfo.IsDir() {
				backgroundExists = true
				fmt.Printf("Found background file at: %s\n", backgroundPath)
				break
			}
		}

		// どちらのモジュールも見つからない場合はエラー
		if !contentExists && !backgroundExists {
			result.Errors = append(result.Errors, "Neither index.js/ts nor content.js/ts and background.js/ts modules found")
		} else if !contentExists {
			result.Errors = append(result.Errors, "Content module file not found: tried .js and .ts in both dist/ and root directory")
		} else if !backgroundExists {
			result.Errors = append(result.Errors, "Background module file not found: tried .js and .ts in both dist/ and root directory")
		} else {
			// 両方存在する場合は両方の条件を満たす
			result.HasContent = true
			result.HasBackground = true
		}
	} else {
		// index.js/tsが存在する場合は両方の条件を満たす
		result.HasContent = true
		result.HasBackground = true
	}

	// 必須ファイルがすべて存在すれば有効とみなす
	result.IsValid = result.HasManifest && result.HasContent && result.HasBackground
	if len(result.Errors) > 0 {
		fmt.Printf("Plugin validation failed for %s:\n", pluginPath)
		for _, err := range result.Errors {
			fmt.Printf("  - %s\n", err)
		}
	} else {
		fmt.Printf("Plugin validation successful for %s\n", pluginPath)
	}

	return result
}

// アイコンファイルのURLを生成
func (a *App) GetIconURL(path string) (string, error) {
	// ファイルが存在するか確認
	_, err := os.Stat(path)
	if err != nil {
		return "", err
	}

	// ファイルスキームURLを返す
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}

	return "file://" + absolutePath, nil
}

// GetIconData 関数を修正
func (a *App) GetIconData(path string) (string, error) {
	fmt.Printf("GetIconData called for: %s\n", path)

	// デフォルトアイコンパス
	defaultIconPath := filepath.Join("frontend", "dist", "assets", "images", "ghost.png")

	// 読み込む対象のパスを決定
	targetPath := path
	var fileData []byte
	var err error

	// 相対パスの場合は絶対パスに変換を試みる
	if !filepath.IsAbs(path) {
		// プラグインディレクトリパスのリストを取得
		pluginDirs := a.GetPluginDirectories()

		// まずは単純に指定されたパスで読み込み試行
		fileData, err = os.ReadFile(path)
		if err != nil {
			fmt.Printf("Failed to read icon directly from %s, trying plugin directories\n", path)

			// 各プラグインディレクトリで探索
			for _, dir := range pluginDirs {
				entries, err := a.ListPluginEntries(dir)
				if err != nil {
					continue
				}

				for _, entry := range entries {
					if entry.IsDirectory {
						// 可能なアイコンパスを検索
						possiblePaths := []string{
							filepath.Join(dir, entry.Name, path),
							filepath.Join(dir, entry.Name, "assets", filepath.Base(path)),
						}

						for _, iconPath := range possiblePaths {
							fmt.Printf("Trying path: %s\n", iconPath)
							fileData, err = os.ReadFile(iconPath)
							if err == nil {
								fmt.Printf("Successfully read icon from: %s\n", iconPath)
								targetPath = iconPath
								break
							}
						}

						if err == nil {
							break
						}
					}
				}

				if err == nil {
					break
				}
			}
		}
	} else {
		// 絶対パスの場合は直接読み込み
		fileData, err = os.ReadFile(path)
	}

	// 読み込みに失敗した場合はデフォルトアイコンを試行
	if err != nil {
		fmt.Printf("Failed to read icon from %s, using default: %s\n", path, defaultIconPath)
		fileData, err = os.ReadFile(defaultIconPath)
		if err != nil {
			return "", fmt.Errorf("could not read icon file or default icon: %v", err)
		}
	}

	// ファイル拡張子からMIMEタイプを特定
	extension := strings.ToLower(filepath.Ext(targetPath))
	mimeType := "image/png" // デフォルト

	switch extension {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".gif":
		mimeType = "image/gif"
	case ".webp":
		mimeType = "image/webp"
	case ".svg":
		mimeType = "image/svg+xml"
	}

	// Base64でエンコード
	base64Data := base64.StdEncoding.EncodeToString(fileData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	return dataURL, nil
}

// ゴーストを切り替える
func (a *App) SwitchGhost(ghostId string) {
	// フロントエンドにイベントを送信
	runtime.EventsEmit(a.ctx, "switch-ghost", ghostId)
}

// プラグインからのログを記録する関数
func (a *App) WritePluginLog(pluginId string, level LogLevel, message string) error {
	// ログディレクトリの設定 - ~/.ghostcursor/logs/
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	logDir := filepath.Join(homeDir, ".ghostcursor", "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// プラグイン固有のログファイル
	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", pluginId))

	// ファイルを開く（存在しない場合は作成し、存在する場合は追記モードで開く）
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	// タイムスタンプ付きでフォーマットされたログメッセージを作成
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	logLine := fmt.Sprintf("[%s] [%s] [%s] %s\n", timestamp, pluginId, level, message)

	// ファイルに書き込み
	_, err = file.WriteString(logLine)

	// 標準出力にも出力
	fmt.Print(logLine)

	return err
}

// プラグインのログファイルを読み込む
func (a *App) ReadPluginLogs(pluginId string, maxLines int) ([]string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	logPath := filepath.Join(homeDir, ".ghostcursor", "logs", fmt.Sprintf("%s.log", pluginId))

	// ファイルが存在しなければ空の配列を返す
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return []string{}, nil
	}

	// ファイルを読み込む
	content, err := os.ReadFile(logPath)
	if err != nil {
		return nil, err
	}

	// 行に分割
	lines := strings.Split(string(content), "\n")

	// 空行を除去
	var nonEmptyLines []string
	for _, line := range lines {
		if line != "" {
			nonEmptyLines = append(nonEmptyLines, line)
		}
	}

	// maxLinesが指定されている場合は最後のN行を返す
	if maxLines > 0 && len(nonEmptyLines) > maxLines {
		return nonEmptyLines[len(nonEmptyLines)-maxLines:], nil
	}

	return nonEmptyLines, nil
}

// プラグインのログファイルをクリア
func (a *App) ClearPluginLogs(pluginId string) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	logPath := filepath.Join(homeDir, ".ghostcursor", "logs", fmt.Sprintf("%s.log", pluginId))

	// ファイルが存在しなければ何もしない
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return nil
	}

	// ファイルを空にする
	return os.WriteFile(logPath, []byte{}, 0644)
}

// プラグインの検証を行う
func (a *App) ValidatePlugins() []PluginValidationResult {
	fmt.Println("ValidatePlugins called")

	results := []PluginValidationResult{}

	// プラグインディレクトリを取得
	pluginDirs := a.GetPluginDirectories()

	for _, dir := range pluginDirs {
		dirResults := a.ValidatePluginDirectory(dir)
		results = append(results, dirResults...)
	}

	return results
}

// 単一のプラグインディレクトリを検証
func (a *App) ValidatePluginDirectory(dir string) []PluginValidationResult {
	fmt.Printf("ValidatePluginDirectory called for: %s\n", dir)

	results := []PluginValidationResult{}

	// ディレクトリの存在を確認
	dirInfo, err := os.Stat(dir)
	if err != nil {
		fmt.Printf("Error: Failed to access directory %s: %v\n", dir, err)
		return results
	}

	if !dirInfo.IsDir() {
		fmt.Printf("Error: %s is not a directory\n", dir)
		return results
	}

	// ディレクトリ内のエントリを取得
	entries, err := os.ReadDir(dir)
	if err != nil {
		fmt.Printf("Error: Failed to read directory %s: %v\n", dir, err)
		return results
	}

	// 各サブディレクトリを検証
	for _, entry := range entries {
		if entry.IsDir() {
			pluginPath := filepath.Join(dir, entry.Name())
			result := a.validatePlugin(pluginPath)
			results = append(results, result)
		}
	}

	return results
}

// GetMousePosX マウスのX座標を取得
func (a *App) GetMousePosX() float64 {
	return float64(C.GetMousePosX())
}

// GetMousePosY マウスのY座標を取得
func (a *App) GetMousePosY() float64 {
	return float64(C.GetMousePosY())
}

// startup関数のリファクタリング
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// グローバル変数に確実に設定
	app = a

	fmt.Println("App startup: context and global app variable initialized")

	// マウス位置を定期的に取得して通知するゴルーチン
	go func() {
		// 約60FPS (16ms間隔) でマウス位置を更新
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()

		for range ticker.C {
			// 内製化したC関数を使ってマウス位置を取得
			x := a.GetMousePosX()
			y := a.GetMousePosY()

			// フロントエンドにイベントを発行（元の実装と同様に-40のオフセット）
			runtime.EventsEmit(a.ctx, "mouse-move", MousePosition{X: x, Y: y - 40})
		}
	}()
}

// GetLastShortcutKeyID はCライブラリから最後に検出されたショートカットキーのIDを取得
func (a *App) GetLastShortcutKeyID() int {
	return int(C.GetLastShortcutKeyID())
}

// GetShiftDoublePressed はCライブラリからShiftキーの二重押しが検出されたかを取得
func (a *App) GetShiftDoublePressed() bool {
	return bool(C.GetShiftDoublePressed())
}

// ResetShiftDoublePressed はCライブラリのShiftキーの二重押しフラグをリセット
func (a *App) ResetShiftDoublePressed() {
	C.ResetShiftDoublePressed()
}

// ショートカットを監視するゴルーチン
func (a *App) startShortcutMonitoring() {
	// 既存の監視ゴルーチンがあれば停止
	if shortcutMonitoringRunning {
		return
	}

	shortcutMonitoringRunning = true

	// 別のゴルーチンでショートカットを監視
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond) // 100msごとに確認
		defer ticker.Stop()

		for shortcutMonitoringRunning {
			select {
			case <-ticker.C:
				// Alt+数字のショートカットをチェック
				scID := a.GetLastShortcutKeyID()
				if scID > 0 {
					var eventType string

					// IDに基づいてイベントタイプを決定
					switch scID {
					case 1:
						eventType = "pushSC1"
					case 2:
						eventType = "pushSC2"
					case 3:
						eventType = "pushSC3"
					case 4:
						eventType = "pushSC4"
					default:
						eventType = "unknown"
					}

					fmt.Printf("Shortcut detected: %s (ID: %d)\n", eventType, scID)

					// フロントエンドにイベントを送信
					if a.ctx != nil {
						runtime.EventsEmit(a.ctx, "shortcut-event", eventType)
					}
				}

				// Shiftキーの二重押しをチェック
				if a.GetShiftDoublePressed() {
					fmt.Println("Shift double-press detected")

					// フロントエンドにイベントを送信
					if a.ctx != nil {
						runtime.EventsEmit(a.ctx, "shortcut-event", "pushSub")
					}

					// フラグをリセット
					a.ResetShiftDoublePressed()
				}
			}
		}
	}()
}

// ショートカット監視を停止
func (a *App) stopShortcutMonitoring() {
	shortcutMonitoringRunning = false
}

// 監視状態を追跡する変数
var shortcutMonitoringRunning bool

var ghostPosX float64
var ghostPosY float64

// GetGhostPosX はゴーストのX座標を返す
func (a *App) GetGhostPosX() float64 {
	return ghostPosX
}

// GetGhostPosY はゴーストのY座標を返す
func (a *App) GetGhostPosY() float64 {
	return ghostPosY
}

// SetGhostPos はゴーストの位置を設定
func (a *App) SetGhostPos(x float64, y float64) {
	ghostPosX = x
	ghostPosY = y
}
