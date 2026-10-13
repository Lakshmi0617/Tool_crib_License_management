; Inno Setup Script for ToolCrib Software Installer
; Prompts for Database Host, Port, Username, Password, and Database Name during installation.

[Setup]
AppName=ToolCrib Software
AppVersion=1.0.0
DefaultDirName={autopf}\ToolCribSoftware
DefaultGroupName=ToolCrib Software
OutputBaseFilename=ToolCrib_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
; Copy all compiled executable files from PyInstaller build output
Source: "backend\dist\ToolCribSoftware\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\ToolCrib Software"; Filename: "{app}\ToolCribSoftware.exe"
Name: "{autodesktop}\ToolCrib Software"; Filename: "{app}\ToolCribSoftware.exe"

[Run]
Filename: "{app}\ToolCribSoftware.exe"; Description: "Launch ToolCrib Software"; Flags: nowait postinstall skipifsilent

[Code]
var
  DBPage: TWizardPage;
  EditHost, EditPort, EditUser, EditPass, EditName: TNewEdit;

procedure InitializeWizard();
var
  lblHost, lblPort, lblUser, lblPass, lblName: TLabel;
begin
  { Create Custom Wizard Page for Database Configuration }
  DBPage := CreateCustomPage(wpSelectDir, 'Database Credentials Configuration', 'Please enter your PostgreSQL database details to connect ToolCrib Software.');

  lblHost := TLabel.Create(WizardForm);
  lblHost.Parent := DBPage.Surface;
  lblHost.Caption := 'Database Host:';
  lblHost.Left := ScaleX(10);
  lblHost.Top := ScaleY(10);

  EditHost := TNewEdit.Create(WizardForm);
  EditHost.Parent := DBPage.Surface;
  EditHost.Text := 'localhost';
  EditHost.Left := ScaleX(120);
  EditHost.Top := ScaleY(8);
  EditHost.Width := ScaleX(200);

  lblPort := TLabel.Create(WizardForm);
  lblPort.Parent := DBPage.Surface;
  lblPort.Caption := 'Database Port:';
  lblPort.Left := ScaleX(10);
  lblPort.Top := ScaleY(40);

  EditPort := TNewEdit.Create(WizardForm);
  EditPort.Parent := DBPage.Surface;
  EditPort.Text := '5432';
  EditPort.Left := ScaleX(120);
  EditPort.Top := ScaleY(38);
  EditPort.Width := ScaleX(200);

  lblUser := TLabel.Create(WizardForm);
  lblUser.Parent := DBPage.Surface;
  lblUser.Caption := 'Database User:';
  lblUser.Left := ScaleX(10);
  lblUser.Top := ScaleY(70);

  EditUser := TNewEdit.Create(WizardForm);
  EditUser.Parent := DBPage.Surface;
  EditUser.Text := 'postgres';
  EditUser.Left := ScaleX(120);
  EditUser.Top := ScaleY(68);
  EditUser.Width := ScaleX(200);

  lblPass := TLabel.Create(WizardForm);
  lblPass.Parent := DBPage.Surface;
  lblPass.Caption := 'Database Password:';
  lblPass.Left := ScaleX(10);
  lblPass.Top := ScaleY(100);

  EditPass := TNewEdit.Create(WizardForm);
  EditPass.Parent := DBPage.Surface;
  EditPass.PasswordChar := '*';
  EditPass.Text := '';
  EditPass.Left := ScaleX(120);
  EditPass.Top := ScaleY(98);
  EditPass.Width := ScaleX(200);

  lblName := TLabel.Create(WizardForm);
  lblName.Parent := DBPage.Surface;
  lblName.Caption := 'Database Name:';
  lblName.Left := ScaleX(10);
  lblName.Top := ScaleY(130);

  EditName := TNewEdit.Create(WizardForm);
  EditName.Parent := DBPage.Surface;
  EditName.Text := 'ToolCrib_v1';
  EditName.Left := ScaleX(120);
  EditName.Top := ScaleY(128);
  EditName.Width := ScaleX(200);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: String;
  EnvFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    EnvFile := ExpandConstant('{app}\.env');
    EnvContent := 'DB_HOST=' + EditHost.Text + #13#10 +
                  'DB_PORT=' + EditPort.Text + #13#10 +
                  'DB_USER=' + EditUser.Text + #13#10 +
                  'DB_PASSWORD=' + EditPass.Text + #13#10 +
                  'DB_NAME=' + EditName.Text + #13#10 +
                  'DATABASE_URL=postgresql://' + EditUser.Text + ':' + EditPass.Text + '@' + EditHost.Text + ':' + EditPort.Text + '/' + EditName.Text + #13#10;
    SaveStringToFile(EnvFile, EnvContent, False);
  end;
end;
