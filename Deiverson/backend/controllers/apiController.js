// personali/backend/controllers/apiController.js

const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const gameManager = require('../game/gameManager');
const { emitNotificationUpdate } = require('../utils/notifications');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const fetchReportData = async (type) => {
    let query = '';
    let transformer = (data) => data; // Función para transformar los datos si es necesario

    switch (type) {
        case 'tickets':
            query = `SELECT id as "ID", username as "Usuario", columns as "Columnas", monto as "Monto", payment_method as "Método", status as "Estado", created_at as "Fecha" FROM tickets ORDER BY created_at DESC`;
            transformer = (rows) => rows.map(row => ({ ...row, Columnas: row.Columnas ? row.Columnas.join(', ') : '' }));
            break;
        case 'pagos':
            query = `SELECT id as "ID Ticket", username as "Usuario", payment_reference as "Referencia", payment_bank as "Banco", monto as "Monto", payment_method as "Método", status as "Estado", created_at as "Fecha" FROM tickets WHERE payment_method = 'Pago Móvil' ORDER BY created_at DESC`;
            break;
        case 'juegos':
            query = `SELECT id as "ID Partida", status as "Estado", winner as "Ganador", sold_columns as "Columnas Vendidas", created_at as "Fecha Inicio", ended_at as "Fecha Fin" FROM bingo_games ORDER BY created_at DESC`;
            transformer = (rows) => rows.map(row => ({ ...row, "Columnas Vendidas": row['Columnas Vendidas'] ? row['Columnas Vendidas'].length : 0 }));
            break;
        case 'ganadores':
            query = `SELECT id as "ID", nombre_ganador as "Nombre", id_partida as "ID Partida", columna_ganadora as "Columna", fecha as "Fecha" FROM ganadores ORDER BY fecha DESC`;
            break;
        case 'cierres':
            query = `SELECT id as "ID", periodo as "Periodo", ingresos_brutos as "Ingresos", premios_pagados as "Premios", ganancia_neta as "Ganancia Neta", realizado_por as "Realizado Por", fecha_cierre as "Fecha" FROM cierres ORDER BY fecha_cierre DESC`;
            break;
        default:
            throw new Error('Tipo de reporte no válido');
    }

    const { rows } = await pool.query(query);
    return transformer(rows);
};

const generateExcelReport = async (res, title, data) => {
    if (data.length === 0) {
        return res.status(404).send('No hay datos para generar el reporte.');
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title);
    
    worksheet.columns = Object.keys(data[0]).map(key => ({ header: key, key: key, width: 20 }));
    
    const dataForExcel = data.map(row => {
        const newRow = {};
        for (const key in row) {
            if (row[key] instanceof Date) {
                newRow[key] = row[key].toLocaleString('es-VE');
            } else {
                newRow[key] = row[key];
            }
        }
        return newRow;
    });

    worksheet.addRows(dataForExcel);

    worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Reporte_${title}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
};

const generatePdfReport = async (res, title, data) => {
    if (data.length === 0) {
        return res.status(404).send('No hay datos para generar el reporte.');
    }
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Reporte_${title}_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text(`Reporte: ${title}`, { align: 'center' }).moveDown();
    doc.fontSize(10).font('Helvetica').text(`Fecha de Generación: ${new Date().toLocaleString('es-VE')}`, { align: 'center' }).moveDown();

    const tableTop = 120;
    const headers = Object.keys(data[0]);
    
    const rows = data.map(item => 
        headers.map(header => {
            const value = item[header];
            if (value instanceof Date) {
                return value.toLocaleString('es-VE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                });
            }
            return value !== null ? value.toString() : 'N/A';
        })
    );

    const colWidths = headers.map(() => (doc.page.width - 60) / headers.length);

    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((header, i) => {
        const x = 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.rect(x, tableTop, colWidths[i], 25).fillAndStroke('#10B981', '#000');
        doc.fillColor('#FFF').text(header, x + 5, tableTop + 8, { width: colWidths[i] - 10, align: 'left' });
    });

    doc.font('Helvetica').fontSize(9);
    rows.forEach((row, rowIndex) => {
        const y = tableTop + (rowIndex + 1) * 25;
        const fillColor = rowIndex % 2 === 0 ? '#f0f0f0' : '#FFF';
        row.forEach((text, i) => {
            const x = 30 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.rect(x, y, colWidths[i], 25).fillAndStroke(fillColor, '#000');
            doc.fillColor('#000').text(text, x + 5, y + 8, { width: colWidths[i] - 10, align: 'left' });
        });
    });

    doc.end();
};

const downloadReport = async (req, res) => {
    const { type, format } = req.query;
    if (!type || !format) {
        return res.status(400).send('Faltan los parámetros "type" y "format".');
    }
    const title = type.charAt(0).toUpperCase() + type.slice(1);

    try {
        const data = await fetchReportData(type);
        
        if (format === 'excel') {
            await generateExcelReport(res, title, data);
        } else if (format === 'pdf') {
            await generatePdfReport(res, title, data);
        } else {
            res.status(400).send('Formato no soportado. Use "excel" o "pdf".');
        }
    } catch (error) {
        console.error(`Error al generar reporte de ${type} en formato ${format}:`, error);
        res.status(500).send(`Error al generar el reporte: ${error.message}`);
    }
};

const exportTicketsToExcel = async (req, res) => {
    try {
        const data = await fetchAllTicketsForReport();
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Tickets');

        const columns = Object.keys(data[0]).map(key => ({ header: key, key: key, width: 15 }));
        worksheet.columns = columns;
        worksheet.addRows(data);

        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte_tickets_apuesta200.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        res.status(500).json({ message: 'Error interno del servidor al generar el Excel.' });
    }
};

const exportTicketsToPDF = async (req, res) => {
    try {
        const data = await fetchAllTicketsForReport();
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte_tickets_apuesta200.pdf');
        doc.pipe(res);

        doc.fillColor('#10b981')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('Reporte de Tickets Apuesta200', { align: 'center' })
           .moveDown(0.5);

        doc.fillColor('#333333')
           .fontSize(12)
           .font('Helvetica')
           .text(`Total de Tickets: ${data.length}`, { align: 'left' });
           
        doc.fontSize(10)
           .text(`Fecha de Generación: ${new Date().toLocaleString('es-VE')}`)
           .moveDown(1.5);
        
        const table = {
            headers: ['ID', 'Usuario', 'Monto', 'Descuento', 'Método', 'Estado', 'Fecha'],
            rows: data.map(t => [
                t.ID.toString(), 
                t.Usuario, 
                `${t.Monto} Bs`, 
                `${t.Descuento} Bs`, 
                t.Metodo, 
                t.Estado, 
                t.Fecha.split(' ')[0]
            ])
        };

        const drawTable = (table, x, y, width) => {
            const rowHeight = 20;
            const headerColor = '#10b981';
            const textColor = '#333333';
            const cellPadding = 5;
            const columnCount = table.headers.length;
            const columnWidth = width / columnCount;
            let currentY = y;

            doc.font('Helvetica-Bold').fillColor(headerColor).fontSize(9);
            for (let i = 0; i < columnCount; i++) {
                const cellX = x + (i * columnWidth);
                doc.rect(cellX, currentY, columnWidth, rowHeight).fill(headerColor);
                doc.fillColor('#FFFFFF').text(table.headers[i], cellX + cellPadding, currentY + cellPadding, {
                       width: columnWidth - (cellPadding * 2),
                       align: 'center'
                });
            }
            currentY += rowHeight;

            doc.font('Helvetica').fontSize(8);
            table.rows.forEach((row, rowIndex) => {
                const rowFillColor = rowIndex % 2 === 0 ? '#f0f0f0' : '#ffffff';
                if (currentY + rowHeight > doc.page.height - doc.options.margin) {
                    doc.addPage();
                    currentY = doc.options.margin;
                }
                doc.fillColor(rowFillColor).rect(x, currentY, width, rowHeight).fill(rowFillColor);
                for (let i = 0; i < columnCount; i++) {
                    const cellX = x + (i * columnWidth);
                    doc.fillColor(textColor).text(row[i], cellX + cellPadding, currentY + cellPadding, {
                        width: columnWidth - (cellPadding * 2),
                        align: (i >= 2 && i <= 3) ? 'right' : 'left'
                    });
                }
                currentY += rowHeight;
            });
            
            doc.lineWidth(1).strokeColor('#cccccc');
            doc.rect(x, y, width, currentY - y).stroke();
        };
        
        const tableX = doc.options.margin;
        const tableWidth = doc.page.width - doc.options.margin * 2;
        drawTable(table, tableX, doc.y, tableWidth);
        doc.end();

    } catch (error) {
        console.error('Error al exportar a PDF:', error);
        res.status(500).json({ message: 'Error interno del servidor al generar el PDF.' });
    }
};

function generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

const createSala = async (req, res) => {
    const { nombre_sala } = req.body;
    if (!nombre_sala) return res.status(400).json({ message: 'El nombre de la sala es requerido.' });
    try {
        const result = await pool.query('INSERT INTO salas (nombre_sala) VALUES ($1) RETURNING *', [nombre_sala]);
        res.status(201).json({ message: 'Sala creada con éxito.', sala: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error interno al crear la sala.' });
    }
};

const getSalasAdmin = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM salas ORDER BY created_at DESC');
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ message: 'Error al obtener las salas.' }); }
};

const getSalasPublic = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT id, nombre_sala FROM salas WHERE activa = TRUE ORDER BY created_at DESC");
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ message: 'Error al obtener las salas.' }); }
};

const toggleSalaStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE salas SET activa = NOT activa WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Sala no encontrada.' });
        res.status(200).json(result.rows[0]);
    } catch (error) { res.status(500).json({ message: 'Error al cambiar el estado de la sala.' }); }
};

const deleteSala = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM salas WHERE id = $1', [id]); // ON DELETE CASCADE borrará los jugadores
        res.status(200).json({ message: 'Sala y todos sus jugadores han sido eliminados.' });
    } catch (error) { res.status(500).json({ message: 'Error al eliminar la sala.' }); }
};

const getSalas = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM salas ORDER BY created_at DESC');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error interno al obtener las salas.' });
    }
};

const addJugadorToSala = async (req, res) => {
    const { sala_id, nombre_jugador, monto, created_by } = req.body;
    if (!sala_id || !nombre_jugador || !monto || monto <= 0 || !created_by) {
        return res.status(400).json({ message: 'Datos incompletos.' });
    }
    let codigo, isCodeUnique = false;
    while (!isCodeUnique) {
        codigo = generateUniqueCode();
        const existing = await pool.query('SELECT 1 FROM jugadores_sala WHERE codigo = $1', [codigo]);
        if (existing.rows.length === 0) isCodeUnique = true;
    }
    try {
        const result = await pool.query(
            'INSERT INTO jugadores_sala (sala_id, nombre_jugador, monto, codigo, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [sala_id, nombre_jugador, monto, codigo, created_by]
        );
        res.status(201).json({ message: 'Jugador añadido con éxito.', jugador: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error interno al añadir el jugador.' });
    }
};

const getJugadoresBySala = async (req, res) => {
    const { sala_id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM jugadores_sala WHERE sala_id = $1 ORDER BY created_at DESC', [sala_id]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error interno al obtener los jugadores.' });
    }
};

const getJugadorById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM jugadores_sala WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const updateJugador = async (req, res) => {
    const { id } = req.params;
    const { nombre_jugador } = req.body;
    if (!nombre_jugador) return res.status(400).json({ message: 'El nombre es requerido.' });
    try {
        const result = await pool.query('UPDATE jugadores_sala SET nombre_jugador = $1 WHERE id = $2 RETURNING *', [nombre_jugador, id]);
        res.status(200).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Error al actualizar jugador.' }); }
};

const adjustJugadorCredits = async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ message: 'Se requiere un monto numérico.' });
    try {
        const result = await pool.query("UPDATE jugadores_sala SET monto = monto + $1 WHERE id = $2 AND status = 'activo' RETURNING *", [amount, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'No se puede ajustar. El jugador no está activo o no existe.' });
        res.status(200).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Error al ajustar créditos.' }); }
};

const deleteJugador = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM jugadores_sala WHERE id = $1', [id]);
        res.status(200).json({ message: 'Jugador eliminado con éxito.' });
    } catch (err) { res.status(500).json({ error: 'Error al eliminar jugador.' }); }
};

const toggleJugadorStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const current = await pool.query('SELECT status FROM jugadores_sala WHERE id = $1', [id]);
        if (current.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado.' });
        const newStatus = current.rows[0].status === 'activo' ? 'inactivo' : 'activo';
        const result = await pool.query('UPDATE jugadores_sala SET status = $1 WHERE id = $2 RETURNING *', [newStatus, id]);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al cambiar el estado del jugador.' });
    }
};

const loginJugadorSala = async (req, res) => {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ message: 'El código de acceso es requerido.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT * FROM jugadores_sala WHERE codigo = $1 AND status = 'activo'", [codigo.toUpperCase()]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ message: 'Código inválido o ya ha sido utilizado.' });
        }
        const jugador = result.rows[0];
        await client.query("UPDATE jugadores_sala SET status = 'usado' WHERE id = $1", [jugador.id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Acceso concedido', jugador: { id: jugador.id, codigo: jugador.codigo, monto: jugador.monto, nombre: jugador.nombre_jugador } });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

const createGameSession = async (req, res) => {
    const { initial_credits, created_by } = req.body; 
    if (!initial_credits || initial_credits <= 0 || !created_by) {
        return res.status(400).json({ message: 'Se requieren créditos iniciales válidos y el nombre del creador.' });
    }
    let sessionCode, isCodeUnique = false, attempts = 0;
    while (!isCodeUnique && attempts < 5) {
        sessionCode = generateUniqueCode();
        const existing = await pool.query('SELECT 1 FROM game_sessions WHERE session_code = $1', [sessionCode]);
        if (existing.rows.length === 0) isCodeUnique = true;
        attempts++;
    }
    if (!isCodeUnique) {
        return res.status(500).json({ message: 'No se pudo generar un código único. Intente de nuevo.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO game_sessions (session_code, credits, status, created_by, created_at) VALUES ($1, $2, 'active', $3, NOW()) RETURNING *`,
            [sessionCode, initial_credits, created_by]
        );
        res.status(201).json({ message: 'Sesión creada con éxito', session: result.rows[0] });
    } catch (error) {
        console.error("Error al crear la sesión de juego:", error);
        res.status(500).json({ message: 'Error interno del servidor al guardar la sesión.' });
    }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
  }
  try {
    const userQuery = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    const user = userQuery.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }
    res.status(200).json({
      message: '¡Inicio de sesión exitoso!',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Error en el proceso de login:', err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const createTicket = async (req, res) => {
  const { io } = req;
  const { columns, paymentMethod, userId, username, payment_reference, payment_bank, status, gameId } = req.body; 
  if (!columns || !Array.isArray(columns) || columns.length === 0 || !username) {
    return res.status(400).json({ message: 'Error: Faltan datos requeridos (columnas, usuario).' });
  }
  let activeGameId = gameId;
  if (!activeGameId) {
      try {
          const activeGameResult = await pool.query("SELECT id FROM bingo_games WHERE status = 'activo' ORDER BY created_at DESC LIMIT 1");
          if (activeGameResult.rows.length > 0) activeGameId = activeGameResult.rows[0].id;
      } catch (error) {
           console.warn("No se pudo obtener el ID del juego activo. El ticket se creará sin game_id.", error);
      }
  }
  if (paymentMethod === 'Pago Móvil' && payment_reference) {
      try {
          const existingTicket = await pool.query("SELECT id FROM tickets WHERE payment_reference = $1", [payment_reference]);
          if (existingTicket.rows.length > 0) {
              return res.status(409).json({ message: 'Este número de referencia de Pago Móvil ya ha sido registrado.' });
          }
      } catch (error) {
          console.error("Error al verificar la unicidad de la referencia:", error);
          return res.status(500).json({ error: 'Error interno del servidor al verificar la referencia de pago.' });
      }
  }
  const basePricePerColumn = 200;
  let montoSinDescuento = columns.length * basePricePerColumn;
  let descuentoAplicado = columns.length === 5 ? 40 : 0;
  const montoFinal = montoSinDescuento - descuentoAplicado;
  const ticketStatus = status || 'pendiente';
  const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO tickets (user_id, username, columns, payment_method, monto, discount, status, created_at, payment_reference, payment_bank, game_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10) RETURNING *`,
        [userId || null, username, `{${columns.join(',')}}`, paymentMethod, montoFinal, descuentoAplicado, ticketStatus, payment_reference, payment_bank, activeGameId]
      );
      const newTicket = result.rows[0];
      await client.query('COMMIT');
      emitNotificationUpdate(io);
      if (ticketStatus === 'pagado' && newTicket.columns) {
          gameManager.purchaseColumns(io, newTicket.columns);
      }
      io.emit('dashboard_update', {});
      res.status(201).json({ message: '¡Ticket creado con éxito!', ticket: newTicket });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Error al guardar el ticket:", err);
      res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
      client.release();
    }
};

const getAdminTickets = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getTicketById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT *, game_id FROM tickets WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Ticket no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const updateTicketStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { io } = req;
  if (!status) return res.status(400).json({ message: 'El nuevo estado es requerido.' });
  try {
    const result = await pool.query('UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Ticket no encontrado.' });
    const updatedTicket = result.rows[0];
    emitNotificationUpdate(io);
    if (status === 'pagado' && updatedTicket.columns) {
        gameManager.purchaseColumns(io, updatedTicket.columns);
    }
    if (status === 'pagado' || status === 'rechazado' || status === 'impreso') {
        io.to(`ticket_${id}`).emit('ticket_status_updated', { id, status });
    }
    io.emit('dashboard_update', {});
    res.status(200).json(updatedTicket);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const updateTicket = async (req, res) => {
    const { id } = req.params;
    const { columns, payment_method } = req.body;
    if (!columns || !payment_method) return res.status(400).json({ message: 'Se requieren las columnas y el método de pago.' });
    const montoCalculado = columns.length * 200;
    try {
        const result = await pool.query(
            'UPDATE tickets SET columns = $1, payment_method = $2, monto = $3 WHERE id = $4 RETURNING *',
            [`{${columns.join(',')}}`, payment_method, montoCalculado, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Ticket no encontrado para modificar.' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const deleteTicket = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Ticket no encontrado para eliminar.' });
        res.status(200).json({ message: `Ticket ${id} eliminado con éxito.` });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getActiveGame = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bingo_games WHERE status = 'activo' ORDER BY created_at DESC LIMIT 1");
    if (result.rows.length === 0) return res.status(404).json({ message: 'No hay ningún juego activo.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getBingoGames = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bingo_games ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message:'Error interno del servidor' });
  }
}

const updateBingoGameStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: 'El nuevo estado es requerido.' });
  try {
    const result = await pool.query('UPDATE bingo_games SET status = $1 WHERE id = $2 RETURNING id, status', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Partida de bingo no encontrada.' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getGameResults = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, id_partida, columna_ganadora as winner, fecha as created_at FROM resultados WHERE status = 'publicado' ORDER BY fecha DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message:'Error interno del servidor' });
  }
};

const createAdminSorteo = async (req, res) => {
  const { io } = req;
  const { patron_ganador, numeros_sorteados, realizado_por } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sorteos_admin (patron_ganador, numeros_sorteados, realizado_por, fecha, estado) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
      [patron_ganador, numeros_sorteados, realizado_por || 'Sorteo Público', 'pendiente']
    );
    io.emit('admin_sorteo_history_update', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const getAdminSorteos = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sorteos_admin ORDER BY fecha DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const updateAdminSorteo = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        const result = await pool.query('UPDATE sorteos_admin SET estado = $1 WHERE id = $2 RETURNING *', [estado, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Sorteo no encontrado.' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const createGanador = async (req, res) => {
  const { io } = req;
  const { nombre_ganador, id_partida, fecha, columna_ganadora, ticket_id } = req.body; 
  if (!nombre_ganador || !id_partida || !columna_ganadora || !ticket_id) {
    return res.status(400).json({ message: 'Faltan campos requeridos.' });
  }
  try {
      const officialResultCheck = await pool.query("SELECT id FROM resultados WHERE id_partida = $1 AND columna_ganadora = $2 AND status = 'publicado'", [id_partida, columna_ganadora]);
      if (officialResultCheck.rows.length === 0) {
          return res.status(403).json({ message: `Error: La Columna ${columna_ganadora} no es resultado oficial para la Partida ID ${id_partida}.` });
      }
  } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor al verificar el resultado.' });
  }
  try {
      const ticketResult = await pool.query("SELECT columns, status FROM tickets WHERE id = $1 AND game_id = $2", [ticket_id, id_partida]);
      if (ticketResult.rows.length === 0) {
          return res.status(404).json({ message: `Error: No se encontró el Ticket ID ${ticket_id} asociado a la Partida ID ${id_partida}.` });
      }
      const ticket = ticketResult.rows[0];
      const ticketColumns = Array.isArray(ticket.columns) ? ticket.columns : (ticket.columns || []).toString().replace(/[{}]/g, '').split(',').map(Number); 
      if (!ticketColumns.includes(columna_ganadora)) {
          return res.status(400).json({ message: `Error: La Columna Ganadora ${columna_ganadora} no fue comprada por el Ticket ID ${ticket_id}.` });
      }
      if (ticket.status !== 'pagado' && ticket.status !== 'impreso') {
           return res.status(403).json({ message: `Error: El Ticket ID ${ticket_id} tiene estado '${ticket.status}' y no es válido.` });
      }
  } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor al validar el ticket.' });
  }
  try {
    const duplicateCheck = await pool.query('SELECT id FROM ganadores WHERE id_partida = $1 AND columna_ganadora = $2', [id_partida, columna_ganadora]);
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ message: `Error: El premio para la Partida ${id_partida} y Columna ${columna_ganadora} ya fue reclamado.` });
    }
    const result = await pool.query('INSERT INTO ganadores (nombre_ganador, id_partida, fecha, columna_ganadora) VALUES ($1, $2, $3, $4) RETURNING *', [nombre_ganador, id_partida, fecha, columna_ganadora]);
    io.emit('ganadores_updated'); 
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const getGanadores = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM ganadores ORDER BY fecha DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const getGanadorById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM ganadores WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Ganador no encontrado.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const updateGanador = async (req, res) => {
    const { io } = req;
    const { id } = req.params;
    const { nombre_ganador, id_partida, columna_ganadora } = req.body;
    if (!nombre_ganador || !id_partida || !columna_ganadora) return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    try {
        const result = await pool.query('UPDATE ganadores SET nombre_ganador = $1, id_partida = $2, columna_ganadora = $3 WHERE id = $4 RETURNING *', [nombre_ganador, id_partida, columna_ganadora, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Ganador no encontrado.' });
        io.emit('ganadores_updated');
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const deleteGanador = async (req, res) => {
    const { io } = req;
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM ganadores WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Ganador no encontrado.' });
        io.emit('ganadores_updated');
        res.status(200).json({ message: `Ganador ${id} eliminado con éxito.` });
    } catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const createResultado = async (req, res) => {
    const { io } = req;
    const { id_partida, columna_ganadora, fecha } = req.body;
    try {
        const result = await pool.query("INSERT INTO resultados (id_partida, columna_ganadora, fecha, status) VALUES ($1, $2, $3, 'borrador') RETURNING *", [id_partida, columna_ganadora, fecha]);
        io.emit('resultados_updated');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const getResultados = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM resultados ORDER BY fecha DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const updateResultado = async (req, res) => {
    const { io } = req;
    const { id } = req.params;
    const { id_partida, columna_ganadora, fecha } = req.body;
    try {
        const result = await pool.query('UPDATE resultados SET id_partida = $1, columna_ganadora = $2, fecha = $3 WHERE id = $4 RETURNING *', [id_partida, columna_ganadora, fecha, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Resultado no encontrado.' });
        io.emit('resultados_updated');
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const deleteResultado = async (req, res) => {
    const { io } = req;
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM resultados WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Resultado no encontrado.' });
        io.emit('resultados_updated');
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const publishResultado = async (req, res) => {
    const { id } = req.params;
    const { io } = req; // Obtenemos io desde el request

    try {
        // Primero, publicamos el resultado como siempre
        const result = await pool.query("UPDATE resultados SET status = 'publicado' WHERE id = $1 RETURNING *", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Resultado no encontrado.' });
        }
        const publishedResult = result.rows[0];

        // --- NUEVA LÓGICA: Finalizar la partida basada en este resultado ---
        const PREMIO_MAYOR = 2000;
        const gameIdToFinalize = publishedResult.id_partida;
        const winningColumn = publishedResult.columna_ganadora;

        // Si no hay partida asociada, simplemente publicamos el resultado y terminamos.
        if (!gameIdToFinalize) {
            io.emit('resultados_updated');
            return res.status(200).json(publishedResult);
        }

        // Obtenemos los ingresos totales de la partida
        const revenueResult = await pool.query(
            "SELECT COALESCE(SUM(monto), 0) as total_ingresos FROM tickets WHERE game_id = $1 AND status IN ('pagado', 'impreso')",
            [gameIdToFinalize]
        );
        const totalRevenue = parseFloat(revenueResult.rows[0].total_ingresos);

        // Verificamos si los ingresos cubren el premio
        if (totalRevenue < PREMIO_MAYOR) {
            console.log(`[AVISO] Resultado ${id} publicado, pero la partida ${gameIdToFinalize} no se finaliza. Ingresos: ${totalRevenue.toFixed(2)} Bs.`);
            io.emit('resultados_updated'); // Actualiza la lista de resultados
            return res.status(200).json({ 
                ...publishedResult, 
                warning: `Resultado publicado, pero la partida no se finalizó porque los ingresos (${totalRevenue.toFixed(2)} Bs) no cubren el premio de ${PREMIO_MAYOR} Bs.`
            });
        }

        // Si los ingresos son suficientes, calculamos la ganancia y finalizamos el juego
        const profitOfGame = totalRevenue - PREMIO_MAYOR;
        console.log(`[Finalizando Partida #${gameIdToFinalize}] Ingresos: ${totalRevenue.toFixed(2)} | Ganancia: ${profitOfGame.toFixed(2)}`);

        // Guardamos la ganancia
        await pool.query(
            'INSERT INTO ganancias (game_id, profit, created_at) VALUES ($1, $2, NOW())',
            [gameIdToFinalize, Math.max(0, profitOfGame)]
        );

        // Actualizamos la partida para establecer el ganador y finalizarla
        await pool.query(
            "UPDATE bingo_games SET status = 'finalizado', winner = $1, ended_at = NOW() WHERE id = $2",
            [winningColumn, gameIdToFinalize]
        );

        // Emitimos todos los eventos necesarios para actualizar los paneles en tiempo real
        io.emit('new_result_added', publishedResult); // Para la página de resultados
        io.emit('resultados_updated'); // Para el admin
        io.emit('game_winner_declared', { winner: winningColumn }); // Para la página de bingo
        io.emit('dashboard_update', {}); // Para refrescar todo el dashboard
        
        // Iniciamos el próximo juego después de un breve retraso
        setTimeout(() => {
            gameManager.resetGame(io);
        }, 5000);

        res.status(200).json(publishedResult);

    } catch (error) {
        console.error("Error al publicar resultado y finalizar partida:", error);
        res.status(500).json({ message: 'Error interno del servidor al publicar el resultado.' });
    }
};

const unpublishResultado = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("UPDATE resultados SET status = 'borrador' WHERE id = $1 RETURNING *", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Resultado no encontrado.' });
        req.io.emit('result_unpublished', { id: parseInt(id, 10) });
        req.io.emit('resultados_updated');
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const getGananciasStats = async (req, res) => {
    try {
        const todayStats = await pool.query("SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= CURRENT_DATE");
        const weekStats = await pool.query("SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= date_trunc('week', CURRENT_TIMESTAMP)");
        const monthStats = await pool.query("SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)");
        res.json({
            gananciasHoy: parseFloat(todayStats.rows[0].total).toFixed(2),
            gananciasSemana: parseFloat(weekStats.rows[0].total).toFixed(2),
            gananciasMes: parseFloat(monthStats.rows[0].total).toFixed(2),
        });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const loginGameSession = async (req, res) => {
    const { session_code } = req.body;
    if (!session_code) return res.status(400).json({ message: 'El código de sesión es requerido.' });
    try {
        const result = await pool.query("SELECT * FROM game_sessions WHERE session_code = $1 AND status = 'active'", [session_code.toUpperCase()]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Código inválido o sesión inactiva/usada.' });
        const session = result.rows[0];
        res.status(200).json({ 
            message: 'Acceso concedido', 
            session: { id: session.id, code: session.session_code, credits: session.credits }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

const setSoldOutIntervalController = async (req, res) => {
    const { io } = req;
    const { intervalMs } = req.body; 
    if (typeof intervalMs !== 'number' || intervalMs < 1000) {
        return res.status(400).json({ message: 'El intervalo debe ser un número en milisegundos y ser al menos 1000ms (1s).' });
    }
    try {
        gameManager.setSoldOutInterval(io, intervalMs); 
        res.status(200).json({ message: `Intervalo de sold out actualizado a ${intervalMs / 1000} segundos.` });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

const forceStartNextGameController = async (req, res) => {
    const { io } = req;
    try {
        await gameManager.forceStartNextGame(io);
        res.status(200).json({ message: 'El inicio del siguiente juego ha sido forzado.' });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- NUEVA FUNCIÓN PARA EL CIERRE DE CAJA ---
const getCierreStats = async (req, res) => {
    const PREMIO_MAYOR = 2000;
    try {
        const client = await pool.connect();
        const queries = {
            hoy: {
                ingresos: "SELECT COALESCE(SUM(monto), 0) as total FROM tickets WHERE created_at >= CURRENT_DATE AND status IN ('pagado', 'impreso')",
                premios: `SELECT COUNT(id) * ${PREMIO_MAYOR} as total FROM ganadores WHERE fecha >= CURRENT_DATE`,
                ganancias: "SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= CURRENT_DATE"
            },
            semana: {
                ingresos: "SELECT COALESCE(SUM(monto), 0) as total FROM tickets WHERE created_at >= date_trunc('week', CURRENT_TIMESTAMP) AND status IN ('pagado', 'impreso')",
                premios: `SELECT COUNT(id) * ${PREMIO_MAYOR} as total FROM ganadores WHERE fecha >= date_trunc('week', CURRENT_TIMESTAMP)`,
                ganancias: "SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= date_trunc('week', CURRENT_TIMESTAMP)"
            },
            mes: {
                ingresos: "SELECT COALESCE(SUM(monto), 0) as total FROM tickets WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP) AND status IN ('pagado', 'impreso')",
                premios: `SELECT COUNT(id) * ${PREMIO_MAYOR} as total FROM ganadores WHERE fecha >= date_trunc('month', CURRENT_TIMESTAMP)`,
                ganancias: "SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)"
            }
        };

        const results = {};
        for (const period in queries) {
            const ingresosResult = await client.query(queries[period].ingresos);
            const premiosResult = await client.query(queries[period].premios);
            const gananciasResult = await client.query(queries[period].ganancias); // Nueva consulta

            const ingresos = parseFloat(ingresosResult.rows[0].total);
            const premios = parseFloat(premiosResult.rows[0].total);
            const gananciaNeta = parseFloat(gananciasResult.rows[0].total); // Nueva variable
            
            results[period] = {
                ingresosBrutos: ingresos.toFixed(2),
                premiosPagados: premios.toFixed(2),
                gananciaNeta: gananciaNeta.toFixed(2) // Usamos el cálculo de la tabla de ganancias
            };
        }
        
        client.release();
        res.status(200).json(results);

    } catch (error) {
        console.error("Error al calcular estadísticas de cierre:", error);
        res.status(500).json({ message: 'Error al calcular el cierre.' });
    }
};




// --- NUEVA FUNCIÓN PARA EJECUTAR Y GUARDAR EL CIERRE ---
const executeCierre = async (req, res) => {
    const { periodo, realizado_por } = req.body;
    if (!periodo || !['diario'].includes(periodo)) {
        return res.status(400).json({ message: "Período inválido. Solo se permite 'diario'." });
    }
    const PREMIO_MAYOR = 2000;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Calcular los tres valores por separado
        const ingresosResult = await client.query("SELECT COALESCE(SUM(monto), 0) as total FROM tickets WHERE created_at >= CURRENT_DATE AND status IN ('pagado', 'impreso')");
        const premiosResult = await client.query(`SELECT COUNT(id) * ${PREMIO_MAYOR} as total FROM ganadores WHERE fecha >= CURRENT_DATE`);
        const gananciasResult = await client.query("SELECT COALESCE(SUM(profit), 0) as total FROM ganancias WHERE created_at >= CURRENT_DATE");

        const ingresos = parseFloat(ingresosResult.rows[0].total);
        const premios = parseFloat(premiosResult.rows[0].total);
        const gananciaNeta = parseFloat(gananciasResult.rows[0].total);

        if (ingresos === 0 && premios === 0) {
            return res.status(400).json({ message: 'No hay transacciones para cerrar hoy.' });
        }

        // Guardar el registro en la tabla 'cierres'
        const cierreResult = await client.query(
            `INSERT INTO cierres (ingresos_brutos, premios_pagados, ganancia_neta, periodo, realizado_por)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [ingresos, premios, gananciaNeta, 'Cierre ' + periodo, realizado_por]
        );
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Cierre diario ejecutado y guardado con éxito.', cierre: cierreResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al ejecutar el cierre diario:", error);
        res.status(500).json({ message: 'Error al ejecutar el cierre.' });
    } finally {
        client.release();
    }
};



// --- NUEVA FUNCIÓN PARA OBTENER EL HISTORIAL DE CIERRES ---
const getCierresHistory = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cierres ORDER BY fecha_cierre DESC LIMIT 50');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener historial de cierres:", error);
        res.status(500).json({ message: 'Error al obtener el historial.' });
    }
};

// --- EXPORTACIONES ---
module.exports = {
    loginUser, createTicket, getAdminTickets, getTicketById, updateTicketStatus, updateTicket, deleteTicket, getBingoGames, updateBingoGameStatus, getGameResults, createAdminSorteo, getAdminSorteos, updateAdminSorteo, getActiveGame, getGanadores, createGanador, getGanadorById, updateGanador, deleteGanador, createResultado, getResultados, updateResultado, deleteResultado, publishResultado, unpublishResultado, getGananciasStats, createGameSession, loginGameSession, 
    setSoldOutIntervalController, 
    forceStartNextGameController,
    exportTicketsToExcel, 
    downloadReport,
    exportTicketsToPDF,
    getCierreStats,
    executeCierre,
    getCierresHistory,
    createSala,
    getSalas,
    addJugadorToSala,
    getJugadoresBySala,
    getJugadorById,
    loginJugadorSala,
    getSalasAdmin,
    getSalasPublic,
    toggleSalaStatus,
    deleteJugador,
    updateJugador,
    adjustJugadorCredits,
    deleteSala,
    toggleJugadorStatus,
};