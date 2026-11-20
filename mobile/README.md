# ByaFlux Mobile 0.2.3

Requer Android 9 ou superior. O APK é o instalador. Abra-o, instale o ByaFlux e autorize a instalação quando o Android pedir. O Discord oficial fica separado.

Em Configurações > ByaFlux > Plugins, ative os plugins desejados. Somente os plugins obrigatórios ficam ativos por padrão.

O aplicativo inclui FakeRoles, ByaBadges, FakeBadges, FakeDeafen, FakeDM, FollowMe, FollowUser, ServerInfo, VolumeBooster, ReadAllNotificationsButton, RelationshipNotifier, MessageLoggerEnhanced e IconViewer, além do AlwaysExtended.

As adaptações Android precisam de testes em aparelho real. FollowMe exige Mover membros e usuários em canais de voz do mesmo servidor. VolumeBooster depende dos limites do motor de áudio do Android. FakeDM e FakeBadges são apenas locais. O logger registra mensagens carregadas enquanto está ativo e guarda no aparelho até 500 registros.

## Atualizações

O instalador consulta o canal mobile ao abrir. O ByaFlux também verifica ao iniciar e exibe o botão nas suas configurações. O Android pede confirmação de instalação. Depois de atualizar o instalador, reinstale o ByaFlux por ele para aplicar o novo bundle.

Cada alteração neste ramo compila um APK nos Actions. A publicação automática só acontece com os quatro segredos de assinatura configurados: MOBILE_KEYSTORE_BASE64, MOBILE_KEYSTORE_PASSWORD, MOBILE_KEY_ALIAS e MOBILE_KEY_PASSWORD. Sem eles, o workflow gera somente um artefato de testes e não anuncia atualizações.

Releases mobile usam o prefixo mobile-v e não substituem a release latest do desktop. O canal android.json fica no ramo mobile-updates. Cada publicação precisa de uma versão maior. Preserve a chave de assinatura para atualizar o APK sem desinstalar.

A primeira versão 0.1.0 usava uma assinatura temporária. A migração para uma assinatura permanente requer reinstalar o instalador. Se precisar reinstalar o ByaFlux separado, faça antes uma cópia das configurações desejadas.

## Código

Os overlays fixam fontes e checksums em base-lock.json. Base: Valenced e Valenced Manager, com licenças e créditos preservados. O carregador nativo e os patches assinados usam a versão 1.3.0 original. O workflow compila o JavaScript do ByaFlux e embute o carregador no instalador.

https://github.com/Valenced/valenced
https://github.com/Valenced/valenced-manager

FakeRoles: ative em Plugins, abra seu perfil dentro de um servidor e toque em Cargos visuais. O seletor também está nas opções do plugin. Nenhuma permissão real é alterada.
