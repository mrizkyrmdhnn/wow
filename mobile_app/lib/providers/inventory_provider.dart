import 'package:flutter/foundation.dart';
import 'package:csv/csv.dart';
import 'package:excel/excel.dart';
import '../models/inventory_model.dart';

class InventoryProvider with ChangeNotifier {
  List<Map<String, String>> _parsedData = [];
  List<Map<String, String>> _filteredData = [];
  List<String> _columns = [];
  FileDetails? _fileDetails;
  final InventoryColumnMapping _invCols = InventoryColumnMapping();

  // Table State
  int _currentPage = 1;
  static const int pageSize = 15;
  String? _sortCol;
  bool _sortAsc = true;
  String _searchQuery = '';
  bool _isEditMode = false;

  // Custom Chart State
  String _customLabelCol = '';
  String _customValueCol = '';
  String _customChartType = 'all'; // 'all', 'bar', 'line', 'pie'

  // Input Data Log
  final List<Map<String, String>> _recentAdditions = [];

  // Getters
  List<Map<String, String>> get parsedData => _parsedData;
  List<Map<String, String>> get filteredData => _filteredData;
  List<String> get columns => _columns;
  FileDetails? get fileDetails => _fileDetails;
  InventoryColumnMapping get invCols => _invCols;
  bool get hasData => _parsedData.isNotEmpty;

  int get currentPage => _currentPage;
  String? get sortCol => _sortCol;
  bool get sortAsc => _sortAsc;
  String get searchQuery => _searchQuery;
  bool get isEditMode => _isEditMode;

  String get customLabelCol => _customLabelCol;
  String get customValueCol => _customValueCol;
  String get customChartType => _customChartType;
  List<Map<String, String>> get recentAdditions => _recentAdditions;

  // Total pages
  int get totalPages {
    if (_filteredData.isEmpty) return 1;
    return (_filteredData.length / pageSize).ceil();
  }

  // Current page rows
  List<Map<String, String>> get pageData {
    if (_filteredData.isEmpty) return [];
    final start = (_currentPage - 1) * pageSize;
    if (start >= _filteredData.length) return [];
    final end = (start + pageSize < _filteredData.length) ? start + pageSize : _filteredData.length;
    return _filteredData.sublist(start, end);
  }

  // Toggle Edit Mode
  void toggleEditMode() {
    _isEditMode = !_isEditMode;
    notifyListeners();
  }

  // Set Search Query
  void setSearchQuery(String query) {
    _searchQuery = query.toLowerCase();
    _applyFilter();
  }

  // Set Sorting Column
  void sortBy(String col) {
    if (_sortCol == col) {
      _sortAsc = !_sortAsc;
    } else {
      _sortCol = col;
      _sortAsc = true;
    }
    _applyFilter();
  }

  // Set Current Page
  void setPage(int page) {
    if (page >= 1 && page <= totalPages) {
      _currentPage = page;
      notifyListeners();
    }
  }

  // Apply Config Mapping
  void applyConfig({
    required String device,
    required String status,
    required String type,
    required String location,
    required String ip,
    required String vendor,
  }) {
    _invCols.device = device;
    _invCols.status = status;
    _invCols.type = type;
    _invCols.location = location;
    _invCols.ip = ip;
    _invCols.vendor = vendor;
    notifyListeners();
  }

  // Custom Chart Selectors
  void setCustomLabelCol(String col) {
    _customLabelCol = col;
    notifyListeners();
  }

  void setCustomValueCol(String col) {
    _customValueCol = col;
    notifyListeners();
  }

  void setCustomChartType(String type) {
    _customChartType = type;
    notifyListeners();
  }

  // Process Raw CSV String
  void processCsvString(String csvContent, String filename, int sizeInBytes) {
    final List<List<dynamic>> rows = const CsvToListConverter(eol: '\n').convert(csvContent);
    if (rows.isEmpty) return;

    final header = rows[0].map((e) => e.toString().trim()).toList();
    final data = <Map<String, String>>[];

    for (int i = 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || (row.length == 1 && row[0].toString().trim().isEmpty)) continue;
      final map = <String, String>{};
      for (int c = 0; c < header.length; c++) {
        final val = c < row.length ? row[c].toString().trim() : '';
        map[header[c]] = val;
      }
      data.add(map);
    }

    _loadData(data, header, filename, sizeInBytes);
  }

  // Process Excel File Bytes (.xlsx / .xls)
  void processExcelBytes(Uint8List bytes, String filename) {
    final excel = Excel.decodeBytes(bytes);
    if (excel.tables.isEmpty) return;

    Sheet? targetSheet;
    for (var tableName in excel.tables.keys) {
      final s = excel.tables[tableName];
      if (s != null && s.maxRows > 0) {
        targetSheet = s;
        break;
      }
    }

    if (targetSheet == null) return;

    final rawRows = targetSheet.rows;
    if (rawRows.isEmpty) return;

    // Header
    final header = <String>[];
    final headerRow = rawRows[0];
    for (int i = 0; i < headerRow.length; i++) {
      final val = headerRow[i]?.value?.toString().trim() ?? '';
      header.add(val.isNotEmpty ? val : 'Kolom_${i + 1}');
    }

    final data = <Map<String, String>>[];
    for (int r = 1; r < rawRows.length; r++) {
      final rowCells = rawRows[r];
      if (rowCells.isEmpty) continue;
      final map = <String, String>{};
      bool hasVal = false;
      for (int c = 0; c < header.length; c++) {
        final cellVal = c < rowCells.length ? (rowCells[c]?.value?.toString().trim() ?? '') : '';
        if (cellVal.isNotEmpty) hasVal = true;
        map[header[c]] = cellVal;
      }
      if (hasVal) data.add(map);
    }

    _loadData(data, header, filename, bytes.length);
  }

  // Load Sample Preset Data
  void loadSampleData() {
    final cols = ['Device', 'Status', 'Tipe', 'Lokasi', 'IP Address', 'Vendor'];
    final data = [
      {'Device': 'Router-Core-01', 'Status': 'Online', 'Tipe': 'Router', 'Lokasi': 'Jakarta DataCenter', 'IP Address': '192.168.1.1', 'Vendor': 'Cisco'},
      {'Device': 'Switch-Dist-01', 'Status': 'Online', 'Tipe': 'Switch', 'Lokasi': 'Jakarta DataCenter', 'IP Address': '192.168.1.2', 'Vendor': 'Cisco'},
      {'Device': 'Switch-Access-01', 'Status': 'Online', 'Tipe': 'Switch', 'Lokasi': 'Gedung A - Lt 2', 'IP Address': '192.168.2.10', 'Vendor': 'Aruba'},
      {'Device': 'Switch-Access-02', 'Status': 'Offline', 'Tipe': 'Switch', 'Lokasi': 'Gedung B - Lt 1', 'IP Address': '192.168.3.10', 'Vendor': 'Aruba'},
      {'Device': 'Firewall-Perimeter', 'Status': 'Online', 'Tipe': 'Firewall', 'Lokasi': 'Jakarta DataCenter', 'IP Address': '10.0.0.1', 'Vendor': 'Palo Alto'},
      {'Device': 'AP-Office-01', 'Status': 'Online', 'Tipe': 'Access Point', 'Lokasi': 'Gedung A - Lt 1', 'IP Address': '172.16.0.20', 'Vendor': 'Fortinet'},
      {'Device': 'AP-Office-02', 'Status': 'Maintenance', 'Tipe': 'Access Point', 'Lokasi': 'Gedung A - Lt 2', 'IP Address': '172.16.0.21', 'Vendor': 'Fortinet'},
      {'Device': 'Server-DB-Primary', 'Status': 'Online', 'Tipe': 'Server', 'Lokasi': 'Bandung Site', 'IP Address': '10.10.1.5', 'Vendor': 'Dell'},
      {'Device': 'Server-App-01', 'Status': 'Online', 'Tipe': 'Server', 'Lokasi': 'Bandung Site', 'IP Address': '10.10.1.6', 'Vendor': 'Dell'},
      {'Device': 'Router-Branch-BDG', 'Status': 'Offline', 'Tipe': 'Router', 'Lokasi': 'Bandung Site', 'IP Address': '10.10.0.1', 'Vendor': 'MikroTik'},
      {'Device': 'Switch-BDG-01', 'Status': 'Online', 'Tipe': 'Switch', 'Lokasi': 'Bandung Site', 'IP Address': '10.10.2.1', 'Vendor': 'MikroTik'},
      {'Device': 'AP-Branch-BDG', 'Status': 'Online', 'Tipe': 'Access Point', 'Lokasi': 'Bandung Site', 'IP Address': '10.10.3.1', 'Vendor': 'Aruba'},
    ];

    _loadData(data, cols, 'sample_inventory_data.csv', 4096);
  }

  void _loadData(List<Map<String, String>> data, List<String> cols, String filename, int bytes) {
    _parsedData = List.from(data);
    _columns = List.from(cols);
    _fileDetails = FileDetails(name: filename, sizeInBytes: bytes, rows: data.length, cols: cols.length);
    _recentAdditions.clear();
    _currentPage = 1;
    _sortCol = null;
    _searchQuery = '';
    _isEditMode = false;

    autoDetectColumns();
    _initCustomCharts();
    _applyFilter();
  }

  void autoDetectColumns() {
    final keywords = {
      'device': ['device', 'hostname', 'host', 'nama', 'name', 'perangkat', 'node', 'equipment', 'asset'],
      'status': ['status', 'kondisi', 'state', 'health', 'availability'],
      'type': ['type', 'tipe', 'kategori', 'category', 'jenis', 'kind', 'model', 'class'],
      'location': ['location', 'lokasi', 'site', 'gedung', 'building', 'area', 'region', 'kota', 'city'],
      'ip': ['ip', 'ip_address', 'ipaddress', 'alamat', 'address'],
      'vendor': ['vendor', 'merek', 'brand', 'manufacturer', 'merk', 'make'],
    };

    String findMatch(List<String> list) {
      for (final col in _columns) {
        final colLower = col.toLowerCase();
        if (list.any((k) => colLower.contains(k))) return col;
      }
      return '';
    }

    _invCols.device = findMatch(keywords['device']!) .ifEmpty(_columns.isNotEmpty ? _columns[0] : '');
    _invCols.status = findMatch(keywords['status']!);
    _invCols.type = findMatch(keywords['type']!);
    _invCols.location = findMatch(keywords['location']!);
    _invCols.ip = findMatch(keywords['ip']!);
    _invCols.vendor = findMatch(keywords['vendor']!);

    notifyListeners();
  }

  void _initCustomCharts() {
    if (_columns.isNotEmpty) {
      _customLabelCol = _invCols.device.isNotEmpty ? _invCols.device : _columns[0];
      _customValueCol = _columns.length > 1 ? _columns[1] : _columns[0];
      _customChartType = 'all';
    }
  }

  void _applyFilter() {
    var result = List<Map<String, String>>.from(_parsedData);

    if (_searchQuery.isNotEmpty) {
      result = result.where((row) {
        return _columns.any((col) => (row[col] ?? '').toLowerCase().contains(_searchQuery));
      }).toList();
    }

    if (_sortCol != null && _sortCol!.isNotEmpty) {
      result.sort((a, b) {
        final va = a[_sortCol] ?? '';
        final vb = b[_sortCol] ?? '';
        final na = double.tryParse(va);
        final nb = double.tryParse(vb);
        if (na != null && nb != null) {
          return _sortAsc ? na.compareTo(nb) : nb.compareTo(na);
        }
        return _sortAsc ? va.compareTo(vb) : vb.compareTo(va);
      });
    }

    _filteredData = result;
    _currentPage = 1;
    notifyListeners();
  }

  // Edit Cell Content
  void updateCell(int parsedIndex, String column, String newValue) {
    if (parsedIndex >= 0 && parsedIndex < _parsedData.length) {
      _parsedData[parsedIndex][column] = newValue.trim();
      _applyFilter();
    }
  }

  // Delete Row
  void deleteRow(int parsedIndex) {
    if (parsedIndex >= 0 && parsedIndex < _parsedData.length) {
      _parsedData.removeAt(parsedIndex);
      _applyFilter();
    }
  }

  // Add New Row from Input Form
  void addNewRow(Map<String, String> newRow) {
    _parsedData.insert(0, Map.from(newRow));
    _recentAdditions.insert(0, Map.from(newRow));
    _applyFilter();
  }

  // Clear All Dataset
  void resetAll() {
    _parsedData.clear();
    _filteredData.clear();
    _columns.clear();
    _fileDetails = null;
    _invCols.reset();
    _recentAdditions.clear();
    _currentPage = 1;
    _isEditMode = false;
    _searchQuery = '';
    notifyListeners();
  }

  // Export Filtered Dataset to CSV string
  String exportCsvString() {
    final List<List<dynamic>> rows = [];
    rows.add(_columns);
    for (final row in _filteredData) {
      rows.add(_columns.map((c) => row[c] ?? '').toList());
    }
    return const ListToCsvConverter().convert(rows);
  }

  // ─── STATISTICAL MATH & CHARTS HELPER DATA ─────────────────────────
  Map<String, int> getFrequencyMap(String colName) {
    final Map<String, int> freq = {};
    if (colName.isEmpty) return freq;
    for (final row in _parsedData) {
      final key = (row[colName] ?? '').trim();
      final label = key.isEmpty ? '(kosong)' : key;
      freq[label] = (freq[label] ?? 0) + 1;
    }
    return freq;
  }

  // Status Counts (Online vs Offline)
  Map<String, int> getStatusCounts() {
    if (_invCols.status.isEmpty) return {};
    return getFrequencyMap(_invCols.status);
  }

  // Numeric Stats for Custom Chart Value Column
  Map<String, double> getValueColumnStats(String valCol) {
    if (valCol.isEmpty) return {};
    final nums = <double>[];
    for (final r in _parsedData) {
      final v = double.tryParse(r[valCol] ?? '');
      if (v != null) nums.add(v);
    }

    if (nums.isEmpty) return {};
    final sum = nums.reduce((a, b) => a + b);
    final min = nums.reduce((a, b) => a < b ? a : b);
    final max = nums.reduce((a, b) => a > b ? a : b);
    final avg = sum / nums.length;

    return {
      'rows': _parsedData.length.toDouble(),
      'sum': sum,
      'min': min,
      'max': max,
      'avg': avg,
    };
  }
}

extension StringExt on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
