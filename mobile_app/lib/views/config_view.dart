import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/inventory_provider.dart';

class ConfigView extends StatefulWidget {
  const ConfigView({super.key});

  @override
  State<ConfigView> createState() => _ConfigViewState();
}

class _ConfigViewState extends State<ConfigView> {
  String _device = '';
  String _status = '';
  String _type = '';
  String _location = '';
  String _ip = '';
  String _vendor = '';

  @override
  void initState() {
    super.initState();
    final invCols = context.read<InventoryProvider>().invCols;
    _device = invCols.device;
    _status = invCols.status;
    _type = invCols.type;
    _location = invCols.location;
    _ip = invCols.ip;
    _vendor = invCols.vendor;
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InventoryProvider>();
    final columns = provider.columns;
    final details = provider.fileDetails;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header / Auto Detect Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Pemetaan Kolom Inventaris',
                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  provider.autoDetectColumns();
                  final inv = provider.invCols;
                  setState(() {
                    _device = inv.device;
                    _status = inv.status;
                    _type = inv.type;
                    _location = inv.location;
                    _ip = inv.ip;
                    _vendor = inv.vendor;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Kolom otomatis terdeteksi!')),
                  );
                },
                icon: const Icon(Icons.auto_awesome, size: 12, color: Color(0xFF2563EB)),
                label: Text(
                  'Auto-Deteksi',
                  style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  side: const BorderSide(color: Color(0xFFBFDBFE)),
                  backgroundColor: const Color(0xFFEFF6FF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Column Mapping Container
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                _buildMappingDropdown('Nama Perangkat (Device)', _device, columns, (val) => setState(() => _device = val ?? '')),
                const SizedBox(height: 10),
                _buildMappingDropdown('Status (Up/Down/Online)', _status, columns, (val) => setState(() => _status = val ?? '')),
                const SizedBox(height: 10),
                _buildMappingDropdown('Tipe Perangkat (Category)', _type, columns, (val) => setState(() => _type = val ?? '')),
                const SizedBox(height: 10),
                _buildMappingDropdown('Lokasi / Site', _location, columns, (val) => setState(() => _location = val ?? '')),
                const SizedBox(height: 10),
                _buildMappingDropdown('Alamat IP (IP Address)', _ip, columns, (val) => setState(() => _ip = val ?? '')),
                const SizedBox(height: 10),
                _buildMappingDropdown('Vendor / Merek', _vendor, columns, (val) => setState(() => _vendor = val ?? '')),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      provider.applyConfig(
                        device: _device,
                        status: _status,
                        type: _type,
                        location: _location,
                        ip: _ip,
                        vendor: _vendor,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Konfigurasi pemetaan diterapkan')),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Terapkan Konfigurasi'),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // File Info & Column Chips Card
          if (details != null) ...[
            Text(
              'Informasi Dataset & Kolom',
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _infoRow('Nama File', details.name),
                  _infoRow('Ukuran', details.formattedSize),
                  _infoRow('Total Baris', details.rows.toString()),
                  _infoRow('Total Kolom', details.cols.toString()),
                  const Divider(height: 20),
                  Text('Kolom Terdeteksi:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF64748B))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: columns.map((col) {
                      final isMapped = [
                        provider.invCols.device,
                        provider.invCols.status,
                        provider.invCols.type,
                        provider.invCols.location,
                        provider.invCols.ip,
                        provider.invCols.vendor,
                      ].contains(col);

                      return Chip(
                        label: Text(col),
                        backgroundColor: isMapped ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                        side: BorderSide(color: isMapped ? const Color(0xFFBFDBFE) : const Color(0xFFCBD5E1)),
                        labelStyle: GoogleFonts.inter(
                          fontSize: 11.5,
                          color: isMapped ? const Color(0xFF1E40AF) : const Color(0xFF475569),
                          fontWeight: isMapped ? FontWeight.w600 : FontWeight.w500,
                        ),
                        visualDensity: VisualDensity.compact,
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildMappingDropdown(String label, String currentVal, List<String> columns, ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFF475569))),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          value: columns.contains(currentVal) ? currentVal : '',
          isExpanded: true,
          decoration: InputDecoration(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
          items: [
            const DropdownMenuItem(value: '', child: Text('— Tidak dipetakan —', style: TextStyle(color: Color(0xFF94A3B8)))),
            ...columns.map((c) => DropdownMenuItem(value: c, child: Text(c))),
          ],
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _infoRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12.5, color: const Color(0xFF64748B))),
          Text(val, style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
