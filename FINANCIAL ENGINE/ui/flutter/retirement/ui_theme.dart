import 'package:flutter/material.dart';

const rfCard = BoxDecoration(
  color: Color(0xFF0F172A),
  borderRadius: BorderRadius.all(Radius.circular(12)),
  border: Border.fromBorderSide(BorderSide(color: Color(0xFF1F2937))),
);

final rfHeading = TextStyle(
  fontSize: 20,
  fontWeight: FontWeight.bold,
  color: Color(0xFFE5E7EB),
);

final rfSubheading = TextStyle(
  fontSize: 16,
  fontWeight: FontWeight.w500,
  color: Color(0xFFE5E7EB),
);

final rfResult = TextStyle(
  fontSize: 26,
  fontWeight: FontWeight.w700,
  color: Color(0xFFF97316),
);

InputDecoration rfInput(String label) => InputDecoration(
  labelText: label,
  labelStyle: const TextStyle(color: Color(0xFF9CA3AF)),
  filled: true,
  fillColor: Color(0xFF111827),
  border: OutlineInputBorder(
    borderRadius: BorderRadius.circular(8),
    borderSide: const BorderSide(color: Color(0xFF1F2937)),
  ),
);

final rfButton = ElevatedButton.styleFrom(
  backgroundColor: Color(0xFFF97316),
  foregroundColor: Color(0xFF0B1120),
  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
);

final rfBar = BoxDecoration(
  gradient: LinearGradient(
    colors: [Color(0xFFF97316), Color(0xFF7C2D12)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  ),
  borderRadius: BorderRadius.vertical(top: Radius.circular(999)),
);

final rfLabel = TextStyle(fontSize: 12, color: Color(0xFF9CA3AF));
final rfValue = TextStyle(fontSize: 12, color: Color(0xFFE5E7EB));
