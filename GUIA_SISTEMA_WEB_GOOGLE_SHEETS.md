# Guia Completo - Oficina Pro (Web + Google Sheets)
### Sistema Especializado para Oficinas de Pequeno Porte (São Miguel da Baixa Grande - PI e Interior)

---

## 🎯 O que foi melhorado e transformado?

1. **Transformação em Sistema Web Responsivo (Mobile, Tablet e Desktop)**
   - Funciona em qualquer navegador (Google Chrome, Safari, Edge, etc.) no celular, tablet ou computador.
   - Menu inferior (*Bottom Navigation*) pensado especificamente para celular/tablet com botões rápidos (Início, O.S., Clientes, Boletos, Caixa).
   - Não depende mais de aplicativo desktop travado (Tauri); agora você pode abrir a oficina inteira no bolso.

2. **Banco de Dados no Google Sheets (Planilhas Google) + Offline First**
   - Os dados são sincronizados com a sua planilha do Google Sheets através de um **Google Apps Script Web App**.
   - **Funciona mesmo se a internet oscilar ou cair** na oficina: o sistema usa SQLite em WebAssembly (`sql.js`) gravado no navegador (`IndexedDB`). Quando a internet volta, você clica em sincronizar e tudo vai para a planilha do Google!

3. **Módulo de Boletos Totalmente Profissional**
   - **Painel de Vencimentos em Tempo Real**:
     - 🔴 Boletos Vencidos (alerta em destaque com quantidade de dias em atraso)
     - 🟡 Vencendo Hoje
     - 🟢 Próximos 7 dias
     - 💼 Total a pagar no mês e total já quitado
   - **Filtros rápidos** por status (Pendentes, Vencidos, Vence Hoje, Próximos 7 dias, Pagos, Todos).
   - **Cópia de Código de Barras / Linha Digitável com 1 clique**: copie direto para colar no aplicativo do seu banco (Banco do Brasil, Caixa, Nubank, Bradesco, etc.) pelo celular.
   - **Baixa Inteligente com Saída de Caixa**: Ao marcar o boleto como pago, o sistema automaticamente cria a saída correspondente no Livro Caixa da oficina.
   - **Anexos e Chave PIX**: Permite salvar a chave PIX do fornecedor ou código de barras e observações.

4. **Recursos Pensados para a Realidade da Cidade Pequena**
   - **Apelido / Povoado / Zona Rural**: Clientes agora possuem o campo de "Apelido / Povoado", essencial para identificar o cliente na cidade ("Fulano do Povoado Santa Maria", "Zé da Borracha").
   - **Tipos de Veículos Adaptados**: Destaque para Motos (Honda Pop, CG 160, Bros, Biz), Carros Populares, Caminhonetes e Utilitários.
   - **Cobrança Amigável via WhatsApp em 1 clique**: Na tela de financeiro ("Anotado na Conta" / Caderneta), você tem um botão direto para enviar a mensagem no WhatsApp do cliente com valor, veículo e sua chave PIX configurada.
   - **Aviso de Serviço Pronto via WhatsApp**: Ao finalizar a Ordem de Serviço, você clica no botão do WhatsApp e o cliente recebe na hora o aviso para vir retirar o veículo.

---

## 🚀 Como Executar o Sistema Web

### Opção 1: Rodar na sua oficina (no computador ou na rede Wi-Fi para o celular)
No terminal da pasta do projeto, execute:
```bash
npm run dev -- --host
```
O Vite irá mostrar dois links:
- `http://localhost:1420/` (para acessar no próprio computador)
- `http://192.168.x.x:1420/` (endereço da sua rede Wi-Fi local)

👉 **Dica de Ouro para Celular/Tablet**:
Conecte seu celular no mesmo Wi-Fi da oficina e digite no navegador do celular o endereço `http://192.168.x.x:1420/`. O sistema abrirá perfeitamente adaptado para toque!

### Opção 2: Hospedar na Web Gratuitamente (Vercel, Netlify ou Cloudflare Pages)
Como o sistema foi compilado para Web estática pura (`dist/`), você pode subir a pasta `dist` ou o repositório na **Vercel** ou **Netlify** com 1 clique. Assim você terá um link como:
`https://minhaoficinapro.vercel.app` para acessar de qualquer lugar do mundo!

---

## 📊 Como Conectar com o Google Sheets (Passo a Passo)

Já deixamos o script pronto no arquivo `google-sheets-script.js`. Siga estes 4 passos:

1. **Crie uma Planilha no Google Sheets**:
   - Acesse [Google Sheets](https://sheets.new) e dê um nome (Ex.: `Oficina Pro - Dados`).
2. **Abra o Editor de Scripts**:
   - No menu superior da planilha, clique em **Extensões** -> **Apps Script**.
3. **Cole o Código**:
   - Apague qualquer código existente no editor do Google Apps Script.
   - Abra o arquivo `google-sheets-script.js` deste projeto, copie todo o conteúdo e cole no editor.
   - Clique no ícone de disquete para **Salvar**.
4. **Implantar como Web App**:
   - No canto superior direito, clique em **Implantar** -> **Nova implantação**.
   - No tipo de implantação (engrenagem), selecione **App da Web**.
   - Em **Descrição**, digite: `API Oficina Pro`.
   - Em **Executar como**, selecione: `Eu (seu e-mail)`.
   - Em **Quem pode acessar**, selecione: `Qualquer pessoa` (*Anyone*).
   - Clique em **Implantar**, autorize o acesso com sua conta Google e copie a **URL do App da Web** gerada (algo parecido com `https://script.google.com/macros/s/AKfycb.../exec`).
5. **Colar no Sistema**:
   - Abra o sistema da oficina.
   - Vá no menu **Configurações**.
   - Na seção **Google Sheets (Nuvem)**, cole a URL copiada e clique em **Salvar URL do Google Sheets**.
   - Clique em **Sincronizar Agora**.
   - Automaticamente o sistema criará as abas na sua planilha (`clients`, `vehicles`, `service_orders`, `boletos`, `cash_entries`, etc.) e manterá tudo guardado na nuvem!
