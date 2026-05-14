-- APP 1 — Product Inventory: seed for all 6 instances.
-- Run AFTER supabase/schema.sql. Re-running upserts to the seed values
-- (idempotent reset), so this is safe to use as a "reset demo" command.
--
-- Same 10 SKUs across every instance. Quantities differ so each location
-- looks operationally distinct (Factory 3 is starved, Factory 4 is busy
-- with high reservations, Warehouse 1 is bulk storage, etc.).

insert into public.product_inventory
  (instance_name, sku, product_name, category, on_hand, reserved, reorder_threshold)
values
  -- ─── Factory 1 — baseline mid-stock assembly line ────────────────────
  ('Factory 1', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  42,  6, 10),
  ('Factory 1', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',    18, 14, 12),
  ('Factory 1', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',       120, 25, 30),
  ('Factory 1', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',          9,  4,  8),
  ('Factory 1', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',         64, 12, 20),
  ('Factory 1', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',          0,  0, 15),
  ('Factory 1', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',     88, 40, 24),
  ('Factory 1', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',         23,  5, 10),
  ('Factory 1', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',           37,  8, 12),
  ('Factory 1', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',            14, 11, 10),

  -- ─── Factory 2 — second assembly line, slightly heavier on body ──────
  ('Factory 2', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  30, 18, 10),
  ('Factory 2', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',    55, 12, 12),
  ('Factory 2', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',        80, 40, 30),
  ('Factory 2', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',         22,  8,  8),
  ('Factory 2', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',         96, 24, 20),
  ('Factory 2', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',         28,  5, 15),
  ('Factory 2', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',     64, 20, 24),
  ('Factory 2', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',         12,  3, 10),
  ('Factory 2', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',           25,  6, 12),
  ('Factory 2', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',             9,  4, 10),

  -- ─── Factory 3 — starved line, lots of low-stock & out-of-stock ──────
  ('Factory 3', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  12,  4, 10),
  ('Factory 3', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',    14,  2, 12),
  ('Factory 3', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',        45, 18, 30),
  ('Factory 3', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',          6,  2,  8),
  ('Factory 3', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',         18,  4, 20),
  ('Factory 3', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',         22, 10, 15),
  ('Factory 3', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',      5,  1, 24),
  ('Factory 3', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',          0,  0, 10),
  ('Factory 3', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',           11,  2, 12),
  ('Factory 3', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',             8,  3, 10),

  -- ─── Factory 4 — high-throughput line, heavy reservations ───────────
  ('Factory 4', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  50, 38, 10),
  ('Factory 4', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',    30, 28, 12),
  ('Factory 4', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',       200,160, 30),
  ('Factory 4', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',         18, 12,  8),
  ('Factory 4', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',         70, 55, 20),
  ('Factory 4', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',         35, 22, 15),
  ('Factory 4', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',    100, 95, 24),
  ('Factory 4', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',         18, 14, 10),
  ('Factory 4', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',           28, 22, 12),
  ('Factory 4', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',            18, 16, 10),

  -- ─── Warehouse 1 — bulk storage, large on-hand, low reserved ────────
  ('Warehouse 1', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  500, 20, 10),
  ('Warehouse 1', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',    300, 50, 12),
  ('Warehouse 1', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',       1200,120, 30),
  ('Warehouse 1', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',         250, 30,  8),
  ('Warehouse 1', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',         800, 60, 20),
  ('Warehouse 1', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',         600, 30, 15),
  ('Warehouse 1', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',    1000, 80, 24),
  ('Warehouse 1', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',         220, 18, 10),
  ('Warehouse 1', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',           450, 25, 12),
  ('Warehouse 1', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',            150, 12, 10),

  -- ─── Warehouse 2 — smaller depot, some out-of-stock ─────────────────
  ('Warehouse 2', 'ENG-BLK-3500',   'Engine Block V6 3.5L',             'Engine Components',  120,  8, 10),
  ('Warehouse 2', 'BRK-ASM-FR-220', 'Brake Assembly Front 220mm',       'Braking Systems',     90, 14, 12),
  ('Warehouse 2', 'PNL-STL-1422',   'Steel Panel 1422mm Hot-Rolled',    'Body Panels',          0,  0, 30),
  ('Warehouse 2', 'TRN-UNT-6SPD',   'Transmission Unit 6-Speed Manual', 'Drivetrain',          40,  5,  8),
  ('Warehouse 2', 'BAT-MOD-96V',    'Battery Module 96V Lithium-Ion',   'Electrical',          60, 10, 20),
  ('Warehouse 2', 'WHR-HRN-A12',    'Wiring Harness A12 Main Loom',     'Electrical',           8,  2, 15),
  ('Warehouse 2', 'WHL-ASM-18X8',   'Wheel Assembly 18x8 Alloy',        'Wheels & Tires',       0,  0, 24),
  ('Warehouse 2', 'SUS-KIT-HD',     'Suspension Kit Heavy Duty',        'Suspension',          35,  5, 10),
  ('Warehouse 2', 'DSH-UNT-CLU-3',  'Dashboard Unit Cluster Gen-3',     'Interior',            12,  4, 12),
  ('Warehouse 2', 'SNR-PKG-ADAS',   'Sensor Package ADAS Forward',      'Sensors',             25,  6, 10)

on conflict (instance_name, sku) do update set
  product_name      = excluded.product_name,
  category          = excluded.category,
  on_hand           = excluded.on_hand,
  reserved          = excluded.reserved,
  reorder_threshold = excluded.reorder_threshold,
  updated_at        = now();
