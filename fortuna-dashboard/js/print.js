{
  "nodes": [
    {
      "parameters": {
        "operation": "get",
        "dataTableId": {
          "__rl": true,
          "value": "Tm2TC0rKrU4c1msp",
          "mode": "list",
          "cachedResultName": "FORTUNA LOG ORDER",
          "cachedResultUrl": "/projects/hFqRknMTWXnMyfsU/datatables/Tm2TC0rKrU4c1msp"
        },
        "returnAll": true
      },
      "id": "c2000001-0000-4000-8000-000000000001",
      "name": "GET LOG ORDER - FOR ADD ITEM",
      "type": "n8n-nodes-base.dataTable",
      "typeVersion": 1.1,
      "position": [
        15120,
        3200
      ],
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "// ================== PENGATURAN ==================\n// START item baru: 'NOW' = waktu saat item ditambahkan (deadline dihitung dari sekarang)\n//                  'ORDER' = ikut START order lama\nconst ITEM_START = 'NOW';\n// Jika order lama sudah LUNAS, item tambahan dicatat: 'BELUM LUNAS' (aman) atau 'COPY' (ikut LUNAS)\nconst ADD_TO_PAID_AS = 'BELUM LUNAS';\n// Durasi paket (jam) - samakan dengan node PREPARE ORDER ITEMS\nconst DURATION_MAP = {\n  'CUCI KOMPLIT REGULER': 72, 'EXPRESS 1 HARI': 24, 'EXPRESS 3 JAM': 3, 'EXPRESS 6 JAM': 6,\n  'CUCI REGULER': 72, 'CUCI EXPRESS 1 HARI': 24, 'CUCI EXPRESS 3 JAM': 3, 'CUCI EXPRESS 6 JAM': 6,\n  'SETRIKA REGULER': 48, 'SETRIKA EXPRESS 1 HARI': 24, 'SETRIKA EXPRESS 3 JAM': 3, 'SETRIKA EXPRESS 6 JAM': 6,\n  'FLEKSIBEL': 120, 'EXPRESS 1': 24\n};\n// =================================================\n\nconst rows = $input.all().map(i => i.json || {});\nconst webhook = $('Webhook Utama').first().json || {};\nconst body = typeof webhook.body === 'string' ? JSON.parse(webhook.body || '{}') : (webhook.body || {});\nconst b = body.data || webhook.data || {};\n\nconst clean = v => String(v ?? '').trim();\nconst pad = n => String(n).padStart(2, '0');\nconst fail = msg => [{ json: { _error: msg } }];\n\nconst cleanMoney = v => {\n  let s = String(v ?? '').trim();\n  if (!s) return '0';\n  const neg = /^[^\\d]*-/.test(s);\n  s = s.replace(/[^\\d.,]/g, '');\n  if (!s) return '0';\n  const hasDot = s.includes('.'), hasComma = s.includes(',');\n  if (hasDot && hasComma) {\n    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';\n    const thou = dec === '.' ? ',' : '.';\n    s = s.split(thou).join('').replace(dec, '.');\n  } else if (hasDot || hasComma) {\n    const sep = hasDot ? '.' : ',';\n    const parts = s.split(sep);\n    const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);\n    s = thousands ? parts.join('') : parts[0] + '.' + parts[1];\n  }\n  const n = Math.round(Number(s));\n  return Number.isFinite(n) ? String((neg ? -1 : 1) * n) : '0';\n};\nconst cleanQty = v => {\n  const s = String(v ?? '').trim().replace(/,/g, '.').replace(/[^\\d.]/g, '');\n  if (!s) return '0';\n  const [intRaw, ...rest] = s.split('.');\n  const intPart = intRaw.replace(/^0+(?=\\d)/, '') || '0';\n  return rest.length ? intPart + '.' + rest.join('') : intPart;\n};\n\n// ---- validasi payload ----\nconst orderId = clean(b.ORDER_ID);\nconst paket   = clean(b.PAKET).toUpperCase();\nconst berat   = cleanQty(b.BERAT);\nconst tagihan = cleanMoney(b.TAGIHAN);\nif (!orderId) return fail('ORDER_ID wajib diisi.');\nif (!paket) return fail('PAKET wajib diisi.');\nif (!(Number(berat) > 0)) return fail('BERAT / jumlah harus lebih dari 0.');\nif (!(Number(tagihan) > 0)) return fail('TAGIHAN harus lebih dari 0.');\n\n// ---- ambil baris order ----\nconst orderRows = rows.filter(r => clean(r.ORDER_ID) === orderId);\nif (!orderRows.length) return fail('Order #' + orderId + ' tidak ditemukan.');\n\n// ---- ITEM_ID berikutnya: pertahankan prefix (identitas instansi ada di prefix ITEM_ID) ----\nconst parsed = orderRows.map(r => {\n  const m = clean(r.ITEM_ID).match(/^(.*?)(\\d+)$/);\n  return m ? { r, prefix: m[1], num: parseInt(m[2], 10), width: m[2].length } : null;\n});\nif (parsed.some(x => !x)) return fail('Format ITEM_ID order #' + orderId + ' tidak dikenali.');\nif (parsed.some(x => x.prefix === '')) return fail('ITEM_ID order #' + orderId + ' tidak punya prefix.');\nif (new Set(parsed.map(x => x.prefix)).size > 1) return fail('Prefix ITEM_ID order #' + orderId + ' tidak seragam.');\n\nconst last = parsed.reduce((a, c) => (c.num > a.num ? c : a));\nconst itemId = last.prefix + String(last.num + 1).padStart(last.width, '0');\n// jaga-jaga bentrok dengan ITEM_ID mana pun di tabel\nif (rows.some(r => clean(r.ITEM_ID) === itemId)) return fail('ITEM_ID ' + itemId + ' sudah dipakai.');\n\nconst base = parsed.slice().sort((a, c) => a.num - c.num)[0].r;\n\n// ---- waktu (format sama dengan PROCESS ORDER) ----\nconst now = new Date();\nconst stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +\n              `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;\nconst start = ITEM_START === 'ORDER' && clean(base.START) ? clean(base.START) : stamp;\n\nconst duration = Object.prototype.hasOwnProperty.call(DURATION_MAP, paket) ? DURATION_MAP[paket] : 0;\nconst startMs = Date.parse(start.replace(' ', 'T'));\nconst readyAt = duration && Number.isFinite(startMs) ? new Date(startMs + duration * 3600000).toISOString() : '';\n\n// ---- pembayaran ----\nlet metode = clean(base.METODE_TRANSAKSI);\nlet statusBayar = clean(base.STATUS_PEMBAYARAN);\nif (statusBayar.toUpperCase() === 'LUNAS' && ADD_TO_PAID_AS !== 'COPY') {\n  metode = ADD_TO_PAID_AS;\n  statusBayar = ADD_TO_PAID_AS;\n}\n\nreturn [{ json: {\n  ORDER_ID: orderId,\n  NAMA: clean(base.NAMA),\n  NO_WA: clean(base.NO_WA),\n  PAKET: paket,\n  BERAT: berat,\n  TAGIHAN: tagihan,\n  START: start,\n  STATUS: 'DITERIMA',\n  READY_AT: readyAt,\n  PICKED_UP_AT: '',\n  METODE_TRANSAKSI: metode,\n  STATUS_PEMBAYARAN: statusBayar,\n  READY_ACTUAL_AT: '',\n  DURATION: String(duration),\n  ITEM_ID: itemId\n} }];"
      },
      "id": "c2000001-0000-4000-8000-000000000002",
      "name": "ADD ITEM - BUILD",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        15344,
        3200
      ]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          },
          "conditions": [
            {
              "id": "d2000001-0000-4000-8000-000000000001",
              "leftValue": "={{ $json._error }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "empty",
                "singleValue": true
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "c2000001-0000-4000-8000-000000000003",
      "name": "ADD ITEM - VALID?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        15568,
        3200
      ]
    },
    {
      "parameters": {
        "dataTableId": {
          "__rl": true,
          "value": "Tm2TC0rKrU4c1msp",
          "mode": "list",
          "cachedResultName": "FORTUNA LOG ORDER",
          "cachedResultUrl": "/projects/hFqRknMTWXnMyfsU/datatables/Tm2TC0rKrU4c1msp"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "ORDER_ID": "={{ $json.ORDER_ID }}",
            "NAMA": "={{ $json.NAMA }}",
            "NO_WA": "={{ $json.NO_WA }}",
            "PAKET": "={{ $json.PAKET }}",
            "BERAT": "={{ $json.BERAT }}",
            "TAGIHAN": "={{ $json.TAGIHAN }}",
            "START": "={{ $json.START }}",
            "STATUS": "={{ $json.STATUS }}",
            "READY_AT": "={{ $json.READY_AT }}",
            "PICKED_UP_AT": "={{ $json.PICKED_UP_AT }}",
            "METODE_TRANSAKSI": "={{ $json.METODE_TRANSAKSI }}",
            "STATUS_PEMBAYARAN": "={{ $json.STATUS_PEMBAYARAN }}",
            "READY_ACTUAL_AT": "={{ $json.READY_ACTUAL_AT }}",
            "DURATION": "={{ $json.DURATION }}",
            "ITEM_ID": "={{ $json.ITEM_ID }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "ORDER_ID",
              "displayName": "ORDER_ID",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "NAMA",
              "displayName": "NAMA",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "NO_WA",
              "displayName": "NO_WA",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "PAKET",
              "displayName": "PAKET",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "BERAT",
              "displayName": "BERAT",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "TAGIHAN",
              "displayName": "TAGIHAN",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "START",
              "displayName": "START",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "STATUS",
              "displayName": "STATUS",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "READY_AT",
              "displayName": "READY_AT",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "PICKED_UP_AT",
              "displayName": "PICKED_UP_AT",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "METODE_TRANSAKSI",
              "displayName": "METODE_TRANSAKSI",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "STATUS_PEMBAYARAN",
              "displayName": "STATUS_PEMBAYARAN",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "READY_ACTUAL_AT",
              "displayName": "READY_ACTUAL_AT",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "DURATION",
              "displayName": "DURATION",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            },
            {
              "id": "ITEM_ID",
              "displayName": "ITEM_ID",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "readOnly": false,
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "id": "c2000001-0000-4000-8000-000000000004",
      "name": "SAVE ADD ITEM",
      "type": "n8n-nodes-base.dataTable",
      "typeVersion": 1.1,
      "position": [
        15792,
        3100
      ]
    },
    {
      "parameters": {
        "jsCode": "const b = $('ADD ITEM - BUILD').first().json;\nif (b._error) return [{ json: { status: 'error', message: b._error } }];\nreturn [{ json: { status: 'success', message: 'Paket berhasil ditambahkan', data: {\n  ORDER_ID: b.ORDER_ID, ITEM_ID: b.ITEM_ID, PAKET: b.PAKET, BERAT: b.BERAT, TAGIHAN: b.TAGIHAN,\n  START: b.START, DURATION: b.DURATION, READY_AT: b.READY_AT, STATUS: b.STATUS\n} } }];"
      },
      "id": "c2000001-0000-4000-8000-000000000005",
      "name": "ADD ITEM RESPONSE",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        16016,
        3200
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Content-Type",
                "value": "application/json; charset=utf-8"
              },
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              }
            ]
          }
        }
      },
      "id": "c2000001-0000-4000-8000-000000000006",
      "name": "RESPOND ADD ITEM",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        16240,
        3200
      ]
    }
  ],
  "connections": {
    "GET LOG ORDER - FOR ADD ITEM": {
      "main": [
        [
          {
            "node": "ADD ITEM - BUILD",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "ADD ITEM - BUILD": {
      "main": [
        [
          {
            "node": "ADD ITEM - VALID?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "ADD ITEM - VALID?": {
      "main": [
        [
          {
            "node": "SAVE ADD ITEM",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "ADD ITEM RESPONSE",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "SAVE ADD ITEM": {
      "main": [
        [
          {
            "node": "ADD ITEM RESPONSE",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "ADD ITEM RESPONSE": {
      "main": [
        [
          {
            "node": "RESPOND ADD ITEM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {}
}
