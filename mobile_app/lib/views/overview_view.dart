import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/inventory_provider.dart';

class OverviewView extends StatelessWidget {
  const OverviewView({super.key});

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
    final parsedData = provider.parsedData;
    final invCols = provider.invCols;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // KPI Cards horizontal scroll
          _buildKPIGrid(provider, parsedData, invCols),
          const SizedBox(height: 24),

          // Status Doughnut Chart Card
          _buildStatusChartCard(provider),
          const SizedBox(height: 20),

          // Type Bar Chart Card
          _buildTypeChartCard(provider),
          const SizedBox(height: 20),

          // Location Chart Card
          _buildLocationChartCard(provider),
          const SizedBox(height: 28),
        ],
      ),
    );
  }

  Widget _buildKPIGrid(InventoryProvider provider, List<Map<String, String>> parsedData, invCols) {
    final cards = <Widget>[];

    // Card 1: Total Devices
    cards.add(_buildKPICard(
      label: 'Total Perangkat',
      value: parsedData.length.toString(),
      sub: 'entri dalam dataset',
      icon: Icons.devices_other_rounded,
      color: const Color(0xFF2563EB),
    ));

    // Card 2: Status
    if (invCols.status.isNotEmpty) {
      final statusMap = provider.getStatusCounts();
      int onlineCount = 0;
      int offlineCount = 0;
      statusMap.forEach((key, count) {
        final k = key.toLowerCase();
        if (['up', 'online', 'aktif', 'active'].contains(k)) onlineCount += count;
        if (['down', 'offline', 'nonaktif', 'inactive'].contains(k)) offlineCount += count;
      });

      if (onlineCount > 0) {
        cards.add(_buildKPICard(
          label: 'Perangkat Aktif',
          value: onlineCount.toString(),
          sub: 'status online/up',
          icon: Icons.check_circle_outline_rounded,
          color: const Color(0xFF10B981),
        ));
      }
      if (offlineCount > 0) {
        cards.add(_buildKPICard(
          label: 'Perangkat Mati',
          value: offlineCount.toString(),
          sub: 'status offline/down',
          icon: Icons.highlight_off_rounded,
          color: const Color(0xFFEF4444),
        ));
      }
    }

    // Card 3: Types
    if (invCols.type.isNotEmpty) {
      final freq = provider.getFrequencyMap(invCols.type);
      cards.add(_buildKPICard(
        label: 'Tipe Perangkat',
        value: freq.keys.length.toString(),
        sub: 'kategori berbeda',
        icon: Icons.category_outlined,
        color: const Color(0xFF8B5CF6),
      ));
    }

    // Card 4: Location
    if (invCols.location.isNotEmpty) {
      final freq = provider.getFrequencyMap(invCols.location);
      cards.add(_buildKPICard(
        label: 'Lokasi / Site',
        value: freq.keys.length.toString(),
        sub: 'site terdaftar',
        icon: Icons.location_on_outlined,
        color: const Color(0xFF06B6D4),
      ));
    }

    return SizedBox(
      height: 124,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: cards.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (_, index) => cards[index],
      ),
    );
  }

  Widget _buildKPICard({
    required String label,
    required String value,
    required String sub,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      width: 165,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ),
              Icon(icon, color: color, size: 18),
            ],
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F172A),
            ),
          ),
          Text(
            sub,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: const Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChartCard(InventoryProvider provider) {
    final statusCol = provider.invCols.status;
    if (statusCol.isEmpty) {
      return _buildNoticeCard('Doughnut Chart Status', 'Pilih kolom Status di tab Konfigurasi');
    }

    final freq = provider.getFrequencyMap(statusCol);
    if (freq.isEmpty) return const SizedBox.shrink();

    final total = freq.values.fold(0, (a, b) => a + b);
    final entries = freq.entries.toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Doughnut Chart — Status Perangkat',
            style: GoogleFonts.inter(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Distribusi kondisi & ketersediaan perangkat',
            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 180,
            child: PieChart(
              PieChartData(
                sectionsSpace: 3,
                centerSpaceRadius: 42,
                sections: entries.asMap().entries.map((e) {
                  final idx = e.key;
                  final entry = e.value;
                  final pct = total > 0 ? (entry.value / total * 100).toStringAsFixed(1) : '0';
                  final color = _getStatusColor(entry.key, idx);
                  return PieChartSectionData(
                    color: color,
                    value: entry.value.toDouble(),
                    title: '$pct%',
                    radius: 40,
                    titleStyle: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Legend Chips
          Wrap(
            spacing: 14,
            runSpacing: 10,
            children: entries.asMap().entries.map((e) {
              final idx = e.key;
              final entry = e.value;
              final color = _getStatusColor(entry.key, idx);
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text(
                    '${entry.key} (${entry.value})',
                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF475569)),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String key, int fallbackIndex) {
    final k = key.toLowerCase();
    if (['up', 'online', 'aktif', 'active'].contains(k)) return const Color(0xFF10B981);
    if (['down', 'offline', 'nonaktif', 'inactive'].contains(k)) return const Color(0xFFEF4444);
    if (['standby', 'maintenance', 'warning'].contains(k)) return const Color(0xFFF59E0B);
    return palette[fallbackIndex % palette.length];
  }

  Widget _buildTypeChartCard(InventoryProvider provider) {
    final typeCol = provider.invCols.type;
    if (typeCol.isEmpty) {
      return _buildNoticeCard('Bar Chart Tipe Perangkat', 'Pilih kolom Tipe di tab Konfigurasi');
    }

    final freq = provider.getFrequencyMap(typeCol);
    if (freq.isEmpty) return const SizedBox.shrink();

    final entries = freq.entries.toList();
    entries.sort((a, b) => b.value.compareTo(a.value));
    final top = entries.take(8).toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bar Chart — Tipe Perangkat',
            style: GoogleFonts.inter(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Kategori perangkat terbanyak',
            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 200,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                borderData: FlBorderData(show: false),
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
                  final idx = e.key;
                  final item = e.value;
                  return BarChartGroupData(
                    x: idx,
                    barRods: [
                      BarChartRodData(
                        toY: item.value.toDouble(),
                        color: palette[idx % palette.length],
                        width: 18,
                        borderRadius: BorderRadius.circular(5),
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

  Widget _buildLocationChartCard(InventoryProvider provider) {
    final locCol = provider.invCols.location;
    if (locCol.isEmpty) {
      return _buildNoticeCard('Column Chart Lokasi', 'Pilih kolom Lokasi di tab Konfigurasi');
    }

    final freq = provider.getFrequencyMap(locCol);
    if (freq.isEmpty) return const SizedBox.shrink();

    final entries = freq.entries.toList();
    entries.sort((a, b) => b.value.compareTo(a.value));
    final top = entries.take(8).toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Column Chart — Distribusi Lokasi',
            style: GoogleFonts.inter(
              fontSize: 15.5,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Jumlah perangkat di tiap lokasi / site',
            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 200,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                borderData: FlBorderData(show: false),
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
                  final idx = e.key;
                  final item = e.value;
                  return BarChartGroupData(
                    x: idx,
                    barRods: [
                      BarChartRodData(
                        toY: item.value.toDouble(),
                        color: const Color(0xFF06B6D4),
                        width: 18,
                        borderRadius: BorderRadius.circular(5),
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

  Widget _buildNoticeCard(String title, String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w600, color: const Color(0xFF334155))),
          const SizedBox(height: 4),
          Text(message, style: GoogleFonts.inter(fontSize: 12.5, color: const Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}
