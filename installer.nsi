; NSIS Installer Script for ToolCrib Software
; Includes custom Database Credentials Page (Host, Port, User, Password, Database Name)
; Generates .env configuration file upon installation

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Name "ToolCrib Software"
OutFile "ToolCrib_Setup.exe"
InstallDir "$PROGRAMFILES64\ToolCribSoftware"
InstallDirRegKey HKCU "Software\ToolCribSoftware" ""
RequestExecutionLevel admin

; Global Variables
Var Dialog
Var LabelHost
Var TextHost
Var LabelPort
Var TextPort
Var LabelUser
Var TextUser
Var LabelPass
Var TextPass
Var LabelName
Var TextName

Var DBHost
Var DBPort
Var DBUser
Var DBPass
Var DBName

; Modern UI Configuration
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom DatabasePageCreate DatabasePageLeave
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\ToolCribSoftware.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ToolCrib Software"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Custom Database Configuration Dialog
Function DatabasePageCreate
    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "Database Credentials Configuration" "Enter PostgreSQL connection details for ToolCrib Software."

    ; Database Host
    ${NSD_CreateLabel} 10u 10u 80u 12u "Database Host:"
    Pop $LabelHost
    ${NSD_CreateText} 100u 8u 180u 12u "localhost"
    Pop $TextHost

    ; Database Port
    ${NSD_CreateLabel} 10u 30u 80u 12u "Database Port:"
    Pop $LabelPort
    ${NSD_CreateText} 100u 28u 180u 12u "5432"
    Pop $TextPort

    ; Database User
    ${NSD_CreateLabel} 10u 50u 80u 12u "Database User:"
    Pop $LabelUser
    ${NSD_CreateText} 100u 48u 180u 12u "postgres"
    Pop $TextUser

    ; Database Password
    ${NSD_CreateLabel} 10u 70u 80u 12u "Database Password:"
    Pop $LabelPass
    ${NSD_CreatePassword} 100u 68u 180u 12u ""
    Pop $TextPass

    ; Database Name
    ${NSD_CreateLabel} 10u 90u 80u 12u "Database Name:"
    Pop $LabelName
    ${NSD_CreateText} 100u 88u 180u 12u "ToolCrib_v1"
    Pop $TextName

    nsDialogs::Show
FunctionEnd

Function DatabasePageLeave
    ${NSD_GetText} $TextHost $DBHost
    ${NSD_GetText} $TextPort $DBPort
    ${NSD_GetText} $TextUser $DBUser
    ${NSD_GetText} $TextPass $DBPass
    ${NSD_GetText} $TextName $DBName

    ${If} $DBHost == ""
    ${OrIf} $DBUser == ""
    ${OrIf} $DBName == ""
        MessageBox MB_ICONEXCLAMATION "Database Host, User, and Database Name are required."
        Abort
    ${EndIf}
FunctionEnd

Section "ToolCrib Software" SecMain
    SetOutPath "$INSTDIR"
    
    ; Copy built files from PyInstaller package
    File /r "backend\dist\ToolCribSoftware\*"

    ; Generate .env file with user inputs
    FileOpen $0 "$INSTDIR\.env" w
    FileWrite $0 "DB_HOST=$DBHost$\r$\n"
    FileWrite $0 "DB_PORT=$DBPort$\r$\n"
    FileWrite $0 "DB_USER=$DBUser$\r$\n"
    FileWrite $0 "DB_PASSWORD=$DBPass$\r$\n"
    FileWrite $0 "DB_NAME=$DBName$\r$\n"
    FileWrite $0 "DATABASE_URL=postgresql://$DBUser:$DBPass@$DBHost:$DBPort/$DBName$\r$\n"
    FileClose $0

    ; Shortcuts
    CreateDirectory "$SMPROGRAMS\ToolCrib Software"
    CreateShortcut "$SMPROGRAMS\ToolCrib Software\ToolCrib Software.lnk" "$INSTDIR\ToolCribSoftware.exe"
    CreateShortcut "$DESKTOP\ToolCrib Software.lnk" "$INSTDIR\ToolCribSoftware.exe"

    ; Uninstaller registration
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ToolCribSoftware" "DisplayName" "ToolCrib Software"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ToolCribSoftware" "UninstallString" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\.env"
    Delete "$INSTDIR\ToolCribSoftware.exe"
    RMDir /r "$INSTDIR"

    Delete "$SMPROGRAMS\ToolCrib Software\ToolCrib Software.lnk"
    RMDir "$SMPROGRAMS\ToolCrib Software"
    Delete "$DESKTOP\ToolCrib Software.lnk"

    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ToolCribSoftware"
    DeleteRegKey HKCU "Software\ToolCribSoftware"
SectionEnd

