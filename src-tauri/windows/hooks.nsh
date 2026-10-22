; Cria o atalho automaticamente, inclusive na instalação normal com interface.
; Em modo perMachine, o contexto de shell configurado pelo Tauri aponta para
; a Área de Trabalho compartilhada por todos os usuários do computador.
!macro NSIS_HOOK_POSTINSTALL
  Call CreateOrUpdateDesktopShortcut
!macroend
