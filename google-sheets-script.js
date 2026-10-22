/**
 * =========================================================================
 * OFICINA PRO - CÓDIGO DO GOOGLE APPS SCRIPT (BANCO DE DADOS EM NUVEM)
 * =========================================================================
 * 
 * Este código conecta o sistema web Oficina Pro diretamente à sua planilha
 * no Google Sheets, funcionando como um banco de dados em nuvem 100% gratuito,
 * acessível do celular, tablet ou computador.
 * 
 * -------------------------------------------------------------------------
 * PASSO A PASSO PARA ATIVAR EM 2 MINUTOS:
 * -------------------------------------------------------------------------
 * 1. Abra o Google Planilhas (https://sheets.new) na sua conta Google.
 * 2. Dê um nome para a planilha, por exemplo: "Banco Oficina Pro".
 * 3. No menu superior da planilha, clique em:
 *    Extensões -> Apps Script
 * 4. Apague todo o conteúdo que estiver na janela e COLE este arquivo inteiro.
 * 5. Clique no botão "Salvar" (ícone de disquete).
 * 6. No canto superior direito, clique no botão azul "Implantar" -> "Nova implantação".
 * 7. Clique na engrenagem ao lado de "Selecione o tipo" e escolha "App da Web".
 * 8. Preencha as opções:
 *    - Descrição: "Backend Oficina Pro"
 *    - Executar como: "Eu (seu email)"
 *    - Quem pode acessar: "Qualquer pessoa" (ou "Qualquer um")
 * 9. Clique em "Implantar" e aceite as permissões da sua conta do Google.
 * 10. COPIE a "URL do aplicativo da Web" (termina com /exec).
 * 11. No Oficina Pro, vá em "Configurações" -> "Google Sheets" e cole essa URL!
 * 
 * Pronto! Todas as Ordens, Clientes, Veículos, Boletos, Estoque e Caixa
 * serão salvos automaticamente na sua planilha do Google Sheets!
 * =========================================================================
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Oficina Pro Sheets Backend funcionando perfeitamente!',
      time: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'get_all') {
    var data = {};
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();
      data[name] = readSheetRows(sheet);
    }
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData.contents;
    var payload = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (payload.action === 'sync_all' && payload.tables) {
      var tables = payload.tables;
      for (var tableName in tables) {
        if (tables.hasOwnProperty(tableName)) {
          var rows = tables[tableName];
          writeSheetRows(ss, tableName, rows);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Todas as tabelas sincronizadas com sucesso!',
        synced_at: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function readSheetRows(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var rows = [];
  
  for (var r = 0; r < values.length; r++) {
    var rowObj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      var val = values[r][c];
      if (val !== '' && val !== null) hasData = true;
      rowObj[headers[c]] = val;
    }
    if (hasData) rows.push(rowObj);
  }
  return rows;
}

function writeSheetRows(ss, tableName, rows) {
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    sheet = ss.insertSheet(tableName);
  }
  
  sheet.clearContents();
  if (!rows || rows.length === 0) return;
  
  var headers = [];
  for (var i = 0; i < rows.length; i++) {
    var keys = Object.keys(rows[i]);
    for (var k = 0; k < keys.length; k++) {
      if (headers.indexOf(keys[k]) === -1) {
        headers.push(keys[k]);
      }
    }
  }
  if (headers.length === 0) return;
  
  // Cabeçalhos estilizados
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#b91c1c')
    .setFontColor('#ffffff');
  
  var data = [];
  for (var r = 0; r < rows.length; r++) {
    var rowArr = [];
    for (var c = 0; c < headers.length; c++) {
      var item = rows[r][headers[c]];
      if (item === undefined || item === null) {
        rowArr.push('');
      } else if (typeof item === 'object') {
        rowArr.push(JSON.stringify(item));
      } else {
        rowArr.push(item);
      }
    }
    data.push(rowArr);
  }
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  
  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch(e) {}
}
