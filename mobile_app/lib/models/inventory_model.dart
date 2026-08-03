class InventoryColumnMapping {
  String device;
  String status;
  String type;
  String location;
  String ip;
  String vendor;

  InventoryColumnMapping({
    this.device = '',
    this.status = '',
    this.type = '',
    this.location = '',
    this.ip = '',
    this.vendor = '',
  });

  void reset() {
    device = '';
    status = '';
    type = '';
    location = '';
    ip = '';
    vendor = '';
  }
}

class FileDetails {
  final String name;
  final int sizeInBytes;
  final int rows;
  final int cols;

  FileDetails({
    required this.name,
    required this.sizeInBytes,
    required this.rows,
    required this.cols,
  });

  String get formattedSize {
    if (sizeInBytes <= 0) return '—';
    if (sizeInBytes < 1024) return '$sizeInBytes B';
    if (sizeInBytes < 1024 * 1024) {
      return '${(sizeInBytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(sizeInBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
