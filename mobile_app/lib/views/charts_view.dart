import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/inventory_provider.dart';

class ChartsView extends StatelessWidget {
  const ChartsView({super.key});

  static const List<Color> palette = [
    Color(0xFF6366F1),
    Color(0xFF0EA5E9),
    Color(0xFF10B981),
    Color(0xFFF59E0B),
    Color(0xFFEC4899),
    Color(0xFF8B5CF6),
    Color(0xFF14B8A6),
    Color(0xFFF97316),
  ];

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InventoryProvider>();
    final columns = provider.columns;
    final labelCol = provider.customLabelCol;
    final valueCol = provider.customValueCol;
    final chartType = provider.customChartType;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Control Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pengaturan Visualisasi Kustom',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 14),

                // Label Select
                Text('Kolom Label / Kategori:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: columns.contains(labelCol) ? labelCol : (columns.isNotEmpty ? columns[0] : null),
                  isExpanded: true,
                  decoration: _dropdownDecoration(),
                  items: columns.map((col) => DropdownMenuItem(value: col, child: Text(col))).toList(),
                  onChanged: (val) {
                    if (val != null) provider.setCustomLabelCol(val);
                  },
                ),
                const SizedBox(height: 12),

                // Value Select
                Text('Kolom Nilai / Metrik:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: columns.contains(valueCol) ? valueCol : (columns.length > 1 ? columns[1] : (columns.isNotEmpty ? columns[0] : null)),
                  isExpanded: true,
                  decoration: _dropdownDecoration(),
                  items: columns.map((col) => DropdownMenuItem(value: col, child: Text(col))).toList(),
                  onChanged: (val) {
                    if (val != null) provider.setCustomValueCol(val);
                  },
                ),
                const SizedBox(height: 14),

                // Chart Type Chips
                Text('Tipe Grafik:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF475569))),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    _typeChip(provider, 'all', 'Semua Grafik'),
                    _typeChip(provider, 'bar', 'Bar Chart'),
                    _typeChip(provider, 'line', 'Line Chart'),
                    _typeChip(provider, 'pie', 'Pie Chart'),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Numerical Stats Card
          _buildStatsCard(provider, valueCol),

          const SizedBox(height: 20),

          // Render Charts
          if (chartType == 'all' || chartType == 'bar') ...[
            _buildBarChart(provider, labelCol, valueCol),
            const SizedBox(height: 16),
          ],
          if (chartType == 'all' || chartType == 'line') ...[
            _buildLineChart(provider, labelCol, valueCol),
            const SizedBox(height: 16),
          ],
          if (chartType == 'all' || chartType == 'pie') ...[
            _buildPieChart(provider, labelCol, valueCol),
            const SizedBox(height: 16),
          ],
        ],
      ),
    );
  }

  InputDecoration _dropdownDecoration() {
    return InputDecoration(
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
    );
  }

  Widget _typeChip(InventoryProvider provider, String typeKey, String label) {
    final isSelected = provider.customChartType == typeKey;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: const Color(0xFF2563EB),
      backgroundColor: const Color(0xFFF1F5F9),
      labelStyle: GoogleFonts.inter(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
        color: isSelected ? Colors.white : const Color(0xFF475569),
      ),
      onSelected: (_) => provider.setCustomChartType(typeKey),
    );
  }

  Widget _buildStatsCard(InventoryProvider provider, String valCol) {
    final stats = provider.getValueColumnStats(valCol);
    if (stats.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ringkasan Statistik ($valCol)',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1E40AF),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _statItem('Rata-rata', stats['avg']!.toStringAsFixed(1))),
              Expanded(child: _statItem('Total Sum', stats['sum']!.toStringAsFixed(0))),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _statItem('Nilai Min', stats['min']!.toStringAsFixed(0))),
              Expanded(child: _statItem('Nilai Max', stats['max']!.toStringAsFixed(0))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 11.5, color: const Color(0xFF64748B))),
        const SizedBox(height: 2),
        Text(value, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A))),
      ],
    );
  }

  Widget _buildBarChart(InventoryProvider provider, String labelCol, String valCol) {
    final freq = provider.getFrequencyMap(labelCol);
    final top = freq.entries.take(8).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  'Bar Chart',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  'Sumbu X: $labelCol',
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF1E40AF)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                borderData: FlBorderData(show: false),
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      final label = (groupIndex >= 0 && groupIndex < top.length) ? top[groupIndex].key : 'Data $groupIndex';
                      return BarTooltipItem(
                        '$label\n',
                        GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        children: [
                          TextSpan(
                            text: 'Jumlah: ${rod.toY.toInt()}',
                            style: GoogleFonts.inter(color: const Color(0xFF93C5FD), fontSize: 11, fontWeight: FontWeight.w500),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 38,
                      getTitlesWidget: (val, meta) {
                        final idx = val.toInt();
                        if (idx >= 0 && idx < top.length) {
                          final label = top[idx].key;
                          final shortLabel = label.length > 7 ? '${label.substring(0, 6)}…' : label;
                          return SideTitleWidget(
                            meta: meta,
                            space: 6,
                            angle: -0.4,
                            child: Text(
                              shortLabel,
                              style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
                barGroups: top.asMap().entries.map((e) {
                  return BarChartGroupData(
                    x: e.key,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.value.toDouble(),
                        color: palette[e.key % palette.length],
                        width: 14,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLineChart(InventoryProvider provider, String labelCol, String valCol) {
    final freq = provider.getFrequencyMap(labelCol);
    final top = freq.entries.take(8).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  'Line Chart — Tren Data',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  'Sumbu X: $labelCol',
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF1E40AF)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: true, drawVerticalLine: false),
                borderData: FlBorderData(show: false),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipItems: (touchedSpots) {
                      return touchedSpots.map((spot) {
                        final idx = spot.x.toInt();
                        final label = (idx >= 0 && idx < top.length) ? top[idx].key : 'Data $idx';
                        return LineTooltipItem(
                          '$label\nJumlah: ${spot.y.toInt()}',
                          GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        );
                      }).toList();
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 38,
                      interval: 1,
                      getTitlesWidget: (val, meta) {
                        final idx = val.toInt();
                        if (val == idx.toDouble() && idx >= 0 && idx < top.length) {
                          final label = top[idx].key;
                          final shortLabel = label.length > 7 ? '${label.substring(0, 6)}…' : label;
                          return SideTitleWidget(
                            meta: meta,
                            space: 6,
                            angle: -0.4,
                            child: Text(
                              shortLabel,
                              style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w500, color: const Color(0xFF64748B)),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: top.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value.value.toDouble())).toList(),
                    isCurved: true,
                    color: const Color(0xFF2563EB),
                    barWidth: 3,
                    dotData: const FlDotData(show: true),
                    belowBarData: BarAreaData(show: true, color: const Color(0xFF2563EB).withOpacity(0.1)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPieChart(InventoryProvider provider, String labelCol, String valCol) {
    final freq = provider.getFrequencyMap(labelCol);
    final top = freq.entries.take(6).toList();
    final total = top.fold(0, (a, b) => a + b.value);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  'Pie Chart — Proporsi',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  'Kategori: $labelCol',
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF1E40AF)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 180,
            child: PieChart(
              PieChartData(
                sections: top.asMap().entries.map((e) {
                  final pct = total > 0 ? (e.value.value / total * 100).toStringAsFixed(1) : '0';
                  return PieChartSectionData(
                    color: palette[e.key % palette.length],
                    value: e.value.value.toDouble(),
                    title: '$pct%',
                    radius: 45,
                    titleStyle: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: top.asMap().entries.map((e) {
              final color = palette[e.key % palette.length];
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 5),
                  Text(
                    '${e.value.key} (${e.value.value})',
                    style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF475569)),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
