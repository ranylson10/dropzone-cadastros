# Arte única para campeonatos e carrossel

Use **1200 × 1500 px, proporção 4:5 (vertical)**, em JPG, PNG ou WebP. O envio de banners dos campeonatos já prepara essa resolução; os formulários agora informam o padrão.

A mesma arte atende aos cards da Home, catálogo, destaques e banners do carrossel. As imagens são ajustadas com preservação de proporção e sem recorte. Nas listas compactas do celular, a arte inteira cabe na miniatura. Selos e ações ficam fora da imagem, e o zoom de hover não corta suas bordas.

Em **Admin → Página inicial → Carrossel principal**, envie a imagem e preencha **Link da imagem**. Se ficar vazio, o clique usa o link do botão principal. O banner também aparece no celular; os três destaques continuam selecionáveis. Configurações anteriores são preservadas e não há migração de banco.

Validação: build com TypeScript, lint dos arquivos alterados, contrato de tema, compatibilidade da configuração antiga e preservação do link após normalização. Doze cenários de experiência aprovados em desktop e Pixel 7; seis cenários de imagem reconferidos após o ajuste decorativo final. Inspeção do catálogo com imagens existentes em 1440 e 390 px confirmou `object-fit: contain`, sem transbordamento. Os testes de banner verificam proporção, ausência de controles sobre a arte, exibição móvel, troca do slide e navegação pelo link.
