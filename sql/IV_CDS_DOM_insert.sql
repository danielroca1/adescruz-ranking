-- ═══════════════════════════════════════════════════════
-- IV CDS DOMINGO (2026-04-12) — concurso_id=4, dia='dom'
-- Idempotente: borra cualquier dato previo antes de insertar
-- ═══════════════════════════════════════════════════════

DELETE FROM resultados_pdf WHERE concurso_id = 4 AND dia = 'dom';

INSERT INTO resultados_pdf
  (concurso_id, dia, prueba, categoria, jinete, caballo, obs, tiempo, ft, total, puesto, puntos, ranking, ranking_caballo)
VALUES
  (4, 'dom', 1, 'Futuros Campeones', 'Samuel Simon Rocha', 'Belen', '0', '74,28', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Breanna Ross', 'Carmeniere', '0', '71,05', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Valentina Castedo', 'Bubbalu', '0', '65,05', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Anialia Soljancic', 'Chianti', '0', '68,29', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Bruna Gutierrez', 'Calabacín', '0', '74,52', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Isabella Trujillo', 'Zion', '0', '74,81', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Samuel Simon Rocha', 'Fantástico', '0', '75,31', '0', '0', '1', 7, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Samuel Simon Rocha', 'Sortilegio', '4', '74,41', '4', '4', NULL, 0, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Carlos Zamorano', 'Conquistador', '4', '71,62', '4', '4', NULL, 0, true, false),
  (4, 'dom', 1, 'Futuros Campeones', 'Luciana Dominguez', 'Carmenier', '4', '66,55', '4', '4', NULL, 0, true, false),
  (4, 'dom', 2, 'Escuela Mayores', 'Carlos Zamorano', 'Conquistador', '0', '78,31', '0', '0', '1', 7, true, false),
  (4, 'dom', 2, 'Escuela Mayores', 'Sara Zelaya', 'Bacardi', '0', '66,68', '0', '0', '2', 5, true, false),
  (4, 'dom', 2, 'Escuela Mayores', 'Margarita Lopez', 'Roma', '0', '80,84', '0', '0', '3', 4, true, false),
  (4, 'dom', 2, 'Escuela Mayores', 'Fharid Galvis', 'Papi', '0', '71,40', '0', '0', '4', 3, true, false),
  (4, 'dom', 2, 'Escuela Mayores', 'Luhana Aguilera', 'Sirius Bocheli', '4', '79,24', '0', '4', '5', 2, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Antonia Numberg', 'Onix Pullman', '0', '76,24', '0', '0', '1', 7, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Antonella Bejarano', 'América Da Riviera', '0', '77,44', '0', '0', '2', 5, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Antonia Numberg', 'Vega', '0', '75,4', '0', '0', '3', 4, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Zoe Alvarez Vaca', 'Toby', '0', '71,16', '0', '0', '4', 3, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Sofía Gallardo', 'Milky Way', '0', '67,76', '0', '0', '5', 2, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Antonella Bejarano', 'Pocahonta', '0', '73,93', '0', '0', '6', 1, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Amanda Aponte', 'Sinfonia', '4', '80,19', '0', '4', '7', 1, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Catalina Montaño', 'Kiara', '4', '66,03', '0', '4', '7', 1, true, false),
  (4, 'dom', 2, 'Escuela Menores', 'Catalina Montaño', 'Fantastico', 'E', 'E', 'E', 'E', '8', 0, true, false),
  (4, 'dom', 2, 'Abierta', 'Henry Gutierrez', 'Troy', '0', '74,41', '0', '0', '1', 7, false, false),
  (4, 'dom', 4, 'Quinta Categoría', 'Camila Moscoso', 'Kaiser', '0', '68,61', '0', '0', '1', 7, true, false),
  (4, 'dom', 4, 'Infantil C', 'Victoria Roca', 'Bastian', '0', '71,78', '0', '0', '1', 7, true, false),
  (4, 'dom', 4, 'Infantil C', 'Aldana Peredo', 'Camelot', '0', '69,34', '0', '0', '2', 5, true, false),
  (4, 'dom', 4, 'Infantil C', 'Luciana Angulo Daza', 'Zafiro', '4', '76,57', '0', '4', '3', 4, true, false),
  (4, 'dom', 4, 'Abierta', 'Rodrigo Daza', 'Tiberius Z', '0', '82,84', '0', '0', '1', 7, false, false),
  (4, 'dom', 4, 'Abierta', 'Kevin Pérez', 'La Marianita Quantino', '4', '61,62', '0', '4', '2', 5, false, false),
  (4, 'dom', 4, 'Abierta', 'Fabio Palma', 'Baral Yaron', 'E', 'E', 'E', 'E', NULL, 0, false, false),
  (4, 'dom', 6, 'Abierta', 'Andres Meyer', 'Fis De Diamant', '0', '77,5', '0', '0', '1', 7, false, false),
  (4, 'dom', 6, 'Abierta', 'Arturo Bedoya', 'Cheep Gipo', '4', '78,29', '0', '4', '2', 5, false, false),
  (4, 'dom', 6, 'Abierta', 'Hermes Lara', 'Caravaggio', '4', '84,18', '0', '4', '2', 5, false, false),
  (4, 'dom', 6, 'Abierta', 'Mauricio Zalles', 'Irina', '8', '70,5', '0', '8', '3', 4, false, false),
  (4, 'dom', 6, 'Abierta', 'Mauricio Zalles', 'Argelina', 'NSP', 'NSP', 'NSP', 'NSP', NULL, 0, false, false),
  (4, 'dom', 7, 'Segunda Categoría', 'Mauricio Zalles', 'Argelina', '0', '70,2', '0', '0', '1', 7, true, false),
  (4, 'dom', 7, 'Segunda Categoría', 'Orlando Montoya', 'Malcom', '4', '91,03', '4', '8', '2', 5, true, false);