import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/inventory_provider.dart';

class TableView extends StatefulWidget {
  const TableView({super.key});

  @override
  State<TableView> createState() => _TableViewState();
}

class _TableViewState extends State<TableView> {
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InventoryProvider>();
    final isEditMode = provider.isEditMode;
    final pageData = provider.pageData;
    final columns = provider.columns;
    final totalRows = provider.filteredData.length;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Toolbar: Search + Action Buttons
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Cari data...',
                    hintStyle: GoogleFonts.inter(fontSize: 13.5, color: const Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                  onChanged: (val) => provider.setSearchQuery(val),
                ),
              ),
              const SizedBox(width: 10),
              // Toggle Edit Mode Button
              ElevatedButton.icon(
                onPressed: () {
                  provider.toggleEditMode();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        provider.isEditMode
                            ? 'Mode Edit Aktif — ketuk sel untuk mengubah atau Hapus baris'
                            : 'Mode Edit Dimatikan',
                      ),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
                icon: Icon(
                  isEditMode ? Icons.check_circle_outline_rounded : Icons.edit_note_rounded,
                  size: 18,
                ),
                label: Text(isEditMode ? 'Selesai' : 'Edit'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isEditMode ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
                  foregroundColor: isEditMode ? Colors.white : const Color(0xFF1E293B),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Edit Mode Banner Notice
          if (isEditMode) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.edit_outlined, color: Color(0xFF2563EB), size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Mode Edit Aktif: Ketuk sel untuk mengubah isi data, atau ketuk Hapus untuk menghapus baris.',
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        color: const Color(0xFF1E40AF),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Table Badge Info
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Data Inventaris (${totalRows.toString()} baris)',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0F172A),
                ),
              ),
              TextButton.icon(
                onPressed: () {
                  final csv = provider.exportCsvString();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Ekspor ${provider.filteredData.length} baris (${csv.length} B) ke CSV'),
                      action: SnackBarAction(label: 'OK', onPressed: () {}),
                    ),
                  );
                },
                icon: const Icon(Icons.download_rounded, size: 16),
                label: const Text('Export CSV'),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF2563EB),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Mobile Table Card Items
          if (pageData.isEmpty)
            Container(
              padding: const EdgeInsets.all(36),
              alignment: Alignment.center,
              child: Text(
                'Tidak ada data ditemukan',
                style: GoogleFonts.inter(fontSize: 13.5, color: const Color(0xFF94A3B8)),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: pageData.length,
              separatorBuilder: (_, _) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final row = pageData[index];
                final parsedIdx = provider.parsedData.indexOf(row);
                return _buildRowCard(context, provider, row, parsedIdx, columns, isEditMode);
              },
            ),

          const SizedBox(height: 20),

          // Pagination Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              OutlinedButton(
                onPressed: provider.currentPage > 1
                    ? () => provider.setPage(provider.currentPage - 1)
                    : null,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Sebelumnya'),
              ),
              Text(
                'Halaman ${provider.currentPage} dari ${provider.totalPages}',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
              ),
              OutlinedButton(
                onPressed: provider.currentPage < provider.totalPages
                    ? () => provider.setPage(provider.currentPage + 1)
                    : null,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Berikutnya'),
              ),
            ],
          ),
          const SizedBox(height: 28),
        ],
      ),
    );
  }

  Widget _buildRowCard(
    BuildContext context,
    InventoryProvider provider,
    Map<String, String> row,
    int parsedIdx,
    List<String> columns,
    bool isEditMode,
  ) {
    final titleCol = provider.invCols.device.isNotEmpty ? provider.invCols.device : (columns.isNotEmpty ? columns[0] : '');
    final statusCol = provider.invCols.status;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isEditMode ? const Color(0xFF93C5FD) : const Color(0xFFE2E8F0),
          width: isEditMode ? 1.4 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row Card Header (Title & Delete / Status)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  row[titleCol] ?? 'Data Entry',
                  style: GoogleFonts.inter(
                    fontSize: 14.5,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ),
              if (isEditMode) ...[
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 22),
                  onPressed: () {
                    provider.deleteRow(parsedIdx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Baris data berhasil dihapus')),
                    );
                  },
                  tooltip: 'Hapus Baris',
                  visualDensity: VisualDensity.compact,
                ),
              ] else if (statusCol.isNotEmpty && (row[statusCol] ?? '').isNotEmpty) ...[
                _buildStatusBadge(row[statusCol]!),
              ],
            ],
          ),
          const Divider(color: Color(0xFFF1F5F9), height: 18),

          // Key-Value Grid
          Wrap(
            spacing: 18,
            runSpacing: 10,
            children: columns.map((col) {
              final val = row[col] ?? '';
              return InkWell(
                onTap: isEditMode ? () => _editCellBottomSheet(context, provider, parsedIdx, col, val) : null,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: isEditMode ? const EdgeInsets.symmetric(horizontal: 8, vertical: 6) : EdgeInsets.zero,
                  decoration: isEditMode
                      ? BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        )
                      : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        col,
                        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            val.isNotEmpty ? val : '—',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          if (isEditMode) ...[
                            const SizedBox(width: 4),
                            const Icon(Icons.edit, size: 12, color: Color(0xFF2563EB)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final s = status.toLowerCase();
    Color bg = const Color(0xFFF1F5F9);
    Color fg = const Color(0xFF475569);

    if (['up', 'online', 'aktif', 'active'].contains(s)) {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF166534);
    } else if (['down', 'offline', 'nonaktif', 'inactive'].contains(s)) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFF991B1B);
    } else if (['standby', 'maintenance'].contains(s)) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFF92400E);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status.toUpperCase(),
        style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }

  void _editCellBottomSheet(BuildContext context, InventoryProvider provider, int parsedIdx, String column, String currentVal) {
    final ctrl = TextEditingController(text: currentVal);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Edit Nilai Kolom: $column',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: ctrl,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: column,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Batal'),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: () {
                      provider.updateCell(parsedIdx, column, ctrl.text);
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Sel berhasil diperbarui')),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Simpan'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
