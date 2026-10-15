import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';

type CarArtProps = {
  width?: number;
  height?: number;
};

// Ilustración del taxi usada en el hero de inicio (referencia visual inicio.html).
export function CarArt({ width = 180, height = 84 }: CarArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 100" role="img" aria-label="Ilustración de un taxi">
      <Ellipse cx={128} cy={86} rx={96} ry={8} fill="#000000" opacity={0.22} />
      <Path d="m42 47 24-29h86l33 28 30 8 8 24H24l3-24Z" fill="#f6c343" />
      <Path d="m75 24-17 23h52V24Zm43 0v23h55l-28-23Z" fill="#527088" />
      <Path d="M66 33h36M135 32h14" stroke="#7b95a9" strokeWidth={3} />
      <Rect x={100} y={8} width={36} height={11} rx={3} fill="#f6c343" />
      <SvgText x={108} y={16} fontFamily="Arial" fontSize={7} fontWeight="bold" fill="#111e2f">
        TAXI
      </SvgText>
      <Path d="M31 58h15m154 0h12M27 71h195M110 25v45m66-20 9 21" stroke="#d8a427" strokeWidth={2} />
      <Rect x={119} y={54} width={13} height={3} rx={1.5} fill="#111e2f" />
      <Circle cx={62} cy={77} r={17} fill="#111e2f" />
      <Circle cx={62} cy={77} r={8} fill="#9baaba" />
      <Circle cx={186} cy={77} r={17} fill="#111e2f" />
      <Circle cx={186} cy={77} r={8} fill="#9baaba" />
      <Path d="M26 56h10v8H25m187-8h7l3 8h-10" fill="#fff3c6" />
    </Svg>
  );
}
